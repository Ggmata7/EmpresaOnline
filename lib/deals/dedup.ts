import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { products, offers } from '../../db/schema.ts';
import { tagAffiliateUrl, type Platform } from '../affiliates/tagger.ts';
import { normalizeTitle, titlesMatch } from './match.ts';
export { normalizeTitle, titlesMatch } from './match.ts';

type Transaction = Parameters<Parameters<PostgresJsDatabase['transaction']>[0]>[0];
export type CapturedOffer = {
  title: string; slug?: string; category: string; imageUrl?: string;
  platform: Platform; externalId: string; sourceUrl: string;
  originalPrice: number | null; currentPrice: number; currency: 'BRL' | 'USD';
  inStock: boolean; checkedAt: Date; shippingPrice?: number | null;
  priceEvidence?: { parser: string; reference: number | null; unitPriceExcluded: boolean };
  referenceProvenance?: string;
  expiresAt?: Date;
};

/** All normalized ingestion paths should call this function inside their transaction. */
export async function captureOfferInTransaction(tx: Transaction, input: CapturedOffer) {
  const international = input.platform === 'amazon_us';
  if (input.currency !== (international ? 'USD' : 'BRL')) throw new Error('currency_region_mismatch');
  if (!normalizeTitle(input.title) || !input.category.trim() || !input.externalId.trim() ||
      !Number.isFinite(input.currentPrice) || input.currentPrice <= 0 ||
      (input.originalPrice !== null && (!Number.isFinite(input.originalPrice) || input.originalPrice <= 0)) ||
      (input.shippingPrice != null && (!Number.isFinite(input.shippingPrice) || input.shippingPrice < 0)) ||
      !Number.isFinite(input.checkedAt.getTime())) throw new Error('invalid_offer');
  const affiliateUrl = tagAffiliateUrl(input.sourceUrl, input.platform);
  const path = new URL(affiliateUrl).pathname;
  const capturedId = input.platform === 'mercado_livre'
    ? path.match(/MLB-?\d+/i)?.[0].replace('-', '').toUpperCase()
    : path.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  if (capturedId !== input.externalId) throw new Error('listing_identity_mismatch');
  // Serialize matching + insertion across workers, including the initial seed.
  await tx.execute(sql`select pg_advisory_xact_lock(20260908, 11)`);
  const [existing] = await tx.select().from(offers).where(and(eq(offers.platform, input.platform), eq(offers.externalId, input.externalId))).limit(1);
  if (existing?.lastCheckedAt && existing.lastCheckedAt > input.checkedAt) return existing;
  let productId = existing?.productId;
  if (productId) {
    const conflicting = await tx.select({ id: offers.id }).from(offers).where(and(eq(offers.productId, productId),
      eq(offers.platform, input.platform), sql`${offers.externalId} <> ${input.externalId}`)).limit(1);
    // Same-marketplace IDs with a generic identical title can be different variants/models.
    if (conflicting.length) productId = undefined;
  }
  if (!productId) {
    const candidates = await tx.select().from(products).where(eq(products.isInternational, international));
    const sameMarketplace = await tx.select({ productId: offers.productId, externalId: offers.externalId }).from(offers).where(eq(offers.platform, input.platform));
    const matches = candidates.filter(product => titlesMatch(product.title, input.title) &&
      !sameMarketplace.some(offer => offer.productId === product.id && offer.externalId !== input.externalId));
    // An ambiguous title is not enough evidence to merge; a supplied slug can disambiguate.
    const matched = matches.length === 1 ? matches[0] : matches.find(product => product.slug === input.slug);
    productId = matched?.id;
    if (!productId) {
      const slug = `${normalizeTitle(input.title).replaceAll(' ', '-').slice(0, 110)}-${international ? 'us' : 'br'}-${randomUUID()}`;
      const [product] = await tx.insert(products).values({ title: input.title.trim(), slug, category: input.category,
        imageUrl: input.imageUrl, isInternational: international }).returning();
      productId = product.id;
    }
  }
  await tx.update(products).set({ category: input.category, updatedAt: new Date() }).where(eq(products.id, productId));
  const values = { productId, platform: input.platform, externalId: input.externalId, sourceUrl: input.sourceUrl,
    affiliateUrl, currentPrice: input.currentPrice.toFixed(2), originalPrice: input.originalPrice?.toFixed(2) ?? null,
    currency: input.currency, inStock: input.inStock, isActive: true, lastCheckedAt: input.checkedAt,
    shippingPrice: input.shippingPrice?.toFixed(2) ?? null,
    referencePriceKind: input.originalPrice === null ? 'unknown' : 'list',
    priceEvidence: input.priceEvidence ?? null,
    referenceProvenance: input.referenceProvenance ?? null, expiresAt: input.expiresAt ?? null, updatedAt: new Date() };
  const [saved] = existing
    ? await tx.update(offers).set(values).where(eq(offers.id, existing.id)).returning()
    : await tx.insert(offers).values(values).returning();
  return saved;
}

export async function captureOffer(db: PostgresJsDatabase, input: CapturedOffer) {
  return db.transaction(tx => captureOfferInTransaction(tx, input));
}
