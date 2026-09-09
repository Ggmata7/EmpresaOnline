import postgres from 'postgres';
import { titlesMatch } from '../lib/deals/match.ts';
const client = postgres(process.env.DATABASE_URL || '', { max: 1, prepare: false,
  ssl: { rejectUnauthorized: false }, connect_timeout: 10, connection: { lock_timeout: 60000 } });
try {
  if (!process.env.DATABASE_URL) throw new Error('database_url_missing');
  await client.begin(async tx => {
    await tx`select pg_advisory_xact_lock(20260908,11)`;
    const rows = await tx`select p.id as product_id,p.title,o.id,o.platform from products p join offers o on o.product_id=p.id
      where not p.is_international and o.currency='BRL' and o.is_active and o.in_stock and (o.expires_at is null or o.expires_at>now())`;
    const amazon = rows.filter(row => row.platform === 'amazon_br');
    const ml = rows.filter(row => row.platform === 'mercado_livre');
    let linked = 0;
    for (const offer of ml) {
      const candidates = amazon.filter(row => titlesMatch(row.title, offer.title));
      if (candidates.length !== 1) continue;
      const target = candidates[0];
      if (ml.filter(row => titlesMatch(target.title, row.title)).length !== 1 || target.product_id === offer.product_id) continue;
      if (rows.some(row => row.product_id === target.product_id && row.platform === 'mercado_livre')) continue;
      await tx`update offers set product_id=${target.product_id},updated_at=now() where id=${offer.id}`;
      // Keep the old product/slug for historical link resolution; no destructive delete.
      offer.product_id = target.product_id;
      console.info('[reconcile]', target.title, '↔', offer.title);
      linked++;
    }
    console.table([{ offersLinkedToSameProduct: linked }]);
  });
} catch (error) { console.error('reconcile_failed', (error as {code?:string}).code || 'validation'); process.exitCode = 1; }
finally { await client.end({ timeout: 5 }); }
