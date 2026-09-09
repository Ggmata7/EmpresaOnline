import postgres from 'postgres';
import { CATEGORIES } from '../lib/offers.ts';
import { lowestPriceFirst } from '../lib/product-comparison.ts';
import { validCoupon } from '../lib/deals/coupon.ts';
import { tagAffiliateUrl } from '../lib/affiliates/tagger.ts';
const client = postgres(process.env.DATABASE_URL || '', { max: 1, prepare: false, ssl: { rejectUnauthorized: false }, connect_timeout: 10 });
try {
  if (!process.env.DATABASE_URL) throw new Error('database_url_missing');
  const rows = await client`select p.id as product_id,p.title,p.normalized_title,p.category,p.is_international,
    o.id,o.platform,o.currency,o.current_price,o.verified_coupon,o.source_url,o.affiliate_url
    from products p join offers o on o.product_id=p.id where o.is_active and o.in_stock and (o.expires_at is null or o.expires_at>now())`;
  console.table(CATEGORIES.map(category => ({ category, nationalDistinctTitles: new Set(rows.filter(row => !row.is_international && row.category === category).map(row => row.normalized_title)).size })));
  console.table(['amazon_br', 'mercado_livre', 'amazon_us'].map(platform => ({ platform, activeOffers: rows.filter(row => row.platform === platform).length })));
  const groups = new Map<string, Array<(typeof rows)[number]>>();
  let invalidTags = 0;
  for (const row of rows) {
    if (row.platform === 'mercado_livre') {
      if (tagAffiliateUrl(row.source_url, 'mercado_livre') !== row.affiliate_url) invalidTags++;
    }
    if (!row.is_international && row.currency === 'BRL') groups.set(row.product_id, [...(groups.get(row.product_id) || []), row]);
  }
  let competingProducts = 0, incorrectWinners = 0;
  for (const group of groups.values()) {
    if (new Set(group.map(row => row.platform)).size < 2) continue;
    competingProducts++;
    const ranked = group.map(row => ({ id: row.id, price: validCoupon(row.verified_coupon, Number(row.current_price))?.price ?? Number(row.current_price) })).sort(lowestPriceFirst);
    if (ranked[0].price !== Math.min(...ranked.map(row => row.price))) incorrectWinners++;
  }
  console.table([{ competingProducts, incorrectWinners, invalidMercadoLivreTags: invalidTags }]);
  if (!competingProducts) console.warn('Sem pares nacionais de identidade comprovada neste lote; regra do menor preço coberta por testes, não por comparações fictícias.');
  if (incorrectWinners || invalidTags) process.exitCode = 1;
} catch (error) { console.error('verification_failed', (error as { code?: string }).code || 'validation'); process.exitCode = 1; }
finally { await client.end({ timeout: 5 }); }
