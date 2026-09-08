import postgres from 'postgres';
import { CATEGORIES } from '../lib/offers.ts';
let client;
try {
  if (!process.env.DATABASE_URL) throw new Error('database_url_missing');
  client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false }, connect_timeout: 10 });
  const rows = await client`select p.category, count(distinct p.id)::int as products,
    count(distinct p.id) filter (where o.is_active and o.in_stock and (o.expires_at is null or o.expires_at > now()))::int as available
    from public.products p left join public.offers o on o.product_id=p.id group by p.category`;
  console.table(CATEGORIES.map(category => { const row = rows.find(item => item.category === category); return { category, products: row?.products || 0, available: row?.available || 0, missingTo100: Math.max(0, 100 - (row?.available || 0)) }; }));
  console.table(await client`select platform, count(*)::int as offers,
    count(*) filter(where is_active and in_stock and (expires_at is null or expires_at > now()))::int as available
    from public.offers group by platform order by platform`);
  console.table(await client`select count(*) filter(where original_price > current_price and history_verified_at is null and price_evidence is null)::int as unverified_discount_anchors,
    count(*) filter(where price_evidence->>'unitPriceExcluded' = 'true')::int as guarded_observations
    from public.offers`);
  console.info('Valores numéricos não permitem reconstruir unidades antigas. Âncoras sem evidência foram arquivadas; os testes validam a rejeição de texto unitário no parser.');
} catch (error) { console.error('report_failed', error.code || 'network'); process.exitCode = 1; }
finally { await client?.end({ timeout: 5 }); }
