import 'server-only';
import { and, asc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { offers, offerPriceHistory } from '@/db/schema';
import { createMarketplaceAdapters, type Observation } from './sync-offers/adapters';
import { mapConcurrent } from './sync-offers/core.mjs';

type Change = Observation & { id: string; checkedAt: Date };

export async function syncOffers() {
  const adapters = createMarketplaceAdapters();
  const diagnostics = adapters.map(({ platform, configured, diagnostic }) => ({ platform, configured, diagnostic }));
  const configured = adapters.filter((adapter) => adapter.configured);
  if (configured.length === 0) return { status: 'not_configured', checked: 0, updated: 0, failed: 0, adapters: diagnostics };
  const deadline = Date.now() + 38000;
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const requestedBatch = Number(process.env.SYNC_BATCH_SIZE || 25);
  const batchSize = Number.isFinite(requestedBatch) ? Math.min(50, Math.max(1, Math.trunc(requestedBatch))) : 25;
  return getDb().transaction(async (tx) => {
    // Transaction-scoped lock prevents overlapping cron invocations across serverless instances.
    const lock = await tx.execute<{ acquired: boolean }>(sql`select pg_try_advisory_xact_lock(20260905, 501) as acquired`);
    if (!lock[0]?.acquired) return { status: 'already_running', checked: 0, updated: 0, failed: 0, adapters: diagnostics };
    const candidates = await tx.select({ id: offers.id, platform: offers.platform, externalId: offers.externalId, sourceUrl: offers.sourceUrl, currency: offers.currency })
      .from(offers).where(and(eq(offers.isActive, true), inArray(offers.platform, configured.map((adapter) => adapter.platform)), or(isNull(offers.lastCheckedAt), lt(offers.lastCheckedAt, cutoff))))
      .orderBy(sql`${offers.lastCheckedAt} asc nulls first`, asc(offers.id)).limit(batchSize);
    const changes: Change[] = [];
    const errors: { offerId: string; code: string }[] = [];
    const results = await mapConcurrent(candidates, async (candidate) => {
      const adapter = configured.find((entry) => entry.platform === candidate.platform)!;
      const observation = await adapter.fetch(candidate);
      if (observation.currency !== candidate.currency) throw new Error('currency_mismatch');
      changes.push({ ...observation, id: candidate.id, checkedAt: new Date() });
    }, 5, deadline);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const message = result.reason instanceof Error ? result.reason.message : '';
        // Allow machine codes only; never forward a token, raw URL, SQL error or partner response.
        errors.push({ offerId: candidates[index].id, code: /^[a-z_0-9]{1,80}$/.test(message) ? message : 'partner_request_failed' });
      }
    });
    let updated = 0;
    if (changes.length) {
      const rows = changes.map((change) => ({ id: change.id, current_price: change.currentPrice, original_price: change.originalPrice, in_stock: change.inStock,
        reference_price_kind: change.referencePriceKind, reference_provenance: change.referenceProvenance,
        is_deal_of_the_day: change.isDealOfTheDay, expires_at: change.expiresAt, shipping_price: change.shippingPrice,
        shipping_label: change.shippingLabel, checked_at: change.checkedAt.toISOString() }));
      const saved = await tx.execute<{ id: string }>(sql`
        update public.offers as o set
          current_price = coalesce(v.current_price, o.current_price), original_price = v.original_price,
          in_stock = v.in_stock, reference_price_kind = v.reference_price_kind, reference_provenance = v.reference_provenance,
          history_verified_at = null, is_deal_of_the_day = v.is_deal_of_the_day, expires_at = v.expires_at,
          shipping_price = v.shipping_price, shipping_label = v.shipping_label,
          last_checked_at = v.checked_at, updated_at = v.checked_at
        from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as v(
          id uuid, current_price numeric, original_price numeric, in_stock boolean, reference_price_kind text,
          reference_provenance text, is_deal_of_the_day boolean, expires_at timestamptz,
          shipping_price numeric, shipping_label text, checked_at timestamptz)
        where o.id = v.id and (o.last_checked_at is null or o.last_checked_at <= v.checked_at)
        returning o.id`);
      updated = saved.length;
      const savedIds = new Set(saved.map((row) => row.id));
      const history = changes.filter((change) => savedIds.has(change.id) && change.currentPrice !== null).map((change) => ({
        offerId: change.id, price: change.currentPrice!.toFixed(2), originalPrice: change.originalPrice?.toFixed(2) ?? null,
        currency: change.currency as 'BRL' | 'USD', inStock: change.inStock, source: change.referenceProvenance, observedAt: change.checkedAt,
      }));
      if (history.length) await tx.insert(offerPriceHistory).values(history).onConflictDoNothing();
    }
    return { status: errors.length ? 'partial' : 'complete', checked: changes.length + errors.length, updated, failed: errors.length,
      deferred: results.filter((result) => result.status === 'skipped').length, batchLimit: batchSize, errors, adapters: diagnostics };
  });
}
