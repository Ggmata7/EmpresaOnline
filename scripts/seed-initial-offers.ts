import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { captureOfferInTransaction } from '../lib/deals/dedup.ts';
import { tagAffiliateUrl } from '../lib/affiliates/tagger.ts';
import { parseAmazonItemResponse, parseMercadoLivreItem } from '../lib/sync-offers/core.mjs';

type Category = 'Tecnologia' | 'Automotivo' | 'Fitness';
type Candidate = {
  title: string; category: Category; imageUrl: string; sourceUrl: string; affiliateUrl: string;
  externalId: string; platform: 'amazon_us' | 'mercado_livre'; currency: 'USD' | 'BRL';
  originalPrice: number; currentPrice: number; checkedAt: Date;
};
const plan: Array<{ category: Category; us: string; br: string }> = [
  { category: 'Tecnologia', us: 'Logitech wireless mouse', br: 'mouse sem fio Logitech' },
  { category: 'Tecnologia', us: 'Anker USB C charger', br: 'carregador USB C Anker' },
  { category: 'Automotivo', us: 'car tire inflator portable', br: 'compressor ar automotivo portatil' },
  { category: 'Fitness', us: 'resistance bands exercise', br: 'kit elasticos resistencia treino' },
  { category: 'Fitness', us: 'yoga mat exercise', br: 'tapete yoga exercicio' },
];

async function json(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`partner_http_${response.status}`);
  return response.json();
}

async function checkImage(raw: string, platform: Candidate['platform']) {
  const url = new URL(raw);
  const allowed = platform === 'amazon_us' ? ['m.media-amazon.com', 'images-na.ssl-images-amazon.com'] : ['http2.mlstatic.com'];
  if (url.protocol !== 'https:' || !allowed.includes(url.hostname) || url.username || url.password || url.port) throw new Error('invalid_product_image');
  const response = await fetch(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('product_image_unavailable');
  return url.toString();
}

function candidate(item: any, platform: Candidate['platform'], category: Category, env: NodeJS.ProcessEnv): Candidate {
  const amazon = platform === 'amazon_us';
  const observation = amazon ? parseAmazonItemResponse({ itemsResult: { items: [item] } }, item.asin, 'USD') : parseMercadoLivreItem(item, item.id);
  if (!observation.inStock || !observation.currentPrice || !observation.originalPrice || observation.originalPrice <= observation.currentPrice) throw new Error('no_verified_discount');
  if (!amazon && (item.condition !== 'new' || !(item.available_quantity > 0))) throw new Error('stock_or_condition_unverified');
  if (observation.expiresAt && Date.parse(observation.expiresAt) <= Date.now()) throw new Error('expired_offer');
  const title = amazon ? item.itemInfo?.title?.displayValue : item.title;
  const imageUrl = amazon ? item.images?.primary?.large?.url : item.pictures?.[0]?.secure_url;
  if (typeof title !== 'string' || title.trim().length < 4 || typeof imageUrl !== 'string') throw new Error('missing_product_metadata');
  const sourceUrl = amazon ? `https://www.amazon.com/dp/${item.asin}` : item.permalink;
  const externalId = amazon ? item.asin : new URL(sourceUrl).pathname.match(/MLB-?\d+/i)?.[0].replace('-', '').toUpperCase();
  const tracked = { externalId, url: tagAffiliateUrl(sourceUrl, platform) };
  if (!amazon && tracked.externalId !== item.id) throw new Error('listing_identity_mismatch');
  return { title: title.trim(), category, imageUrl, sourceUrl, affiliateUrl: tracked.url, externalId: tracked.externalId,
    platform, currency: amazon ? 'USD' : 'BRL', originalPrice: observation.originalPrice, currentPrice: observation.currentPrice, checkedAt: new Date() };
}

async function main() {
  const flag = process.argv.indexOf('--env');
  const envPath = resolve(flag >= 0 ? process.argv[flag + 1] || '.env' : '.env');
  let fileEnv: Record<string, string>;
  try { fileEnv = parseEnv(readFileSync(envPath, 'utf8')); }
  catch { throw new Error('env_file_missing_or_unreadable'); }
  const env = { ...process.env, ...fileEnv };
  const required = ['DATABASE_URL', 'AMAZON_BR_TAG', 'AMAZON_US_TAG', 'AMAZON_US_CREATORS_CLIENT_ID', 'AMAZON_US_CREATORS_CLIENT_SECRET', 'MERCADO_LIVRE_ACCESS_TOKEN'];
  console.table(required.map(name => ({ Variavel: name, Estado: env[name]?.trim() ? 'configurada' : 'ausente' })));
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`missing_environment:${missing.join(',')}`);
  if (env.AMAZON_US_CREATORS_VERSION && env.AMAZON_US_CREATORS_VERSION !== '3.1') throw new Error('unsupported_creators_version');
  const databaseUrl = new URL(env.DATABASE_URL!);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) throw new Error('invalid_database_protocol');

  const auth = await json('https://api.amazon.com/auth/o2/token', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: env.AMAZON_US_CREATORS_CLIENT_ID, client_secret: env.AMAZON_US_CREATORS_CLIENT_SECRET, scope: 'creatorsapi::default' }) });
  if (typeof auth.access_token !== 'string') throw new Error('invalid_amazon_authentication');
  const chosen: Candidate[] = [];
  for (const platform of ['amazon_us', 'mercado_livre'] as const) {
    for (const query of plan) {
      let items: any[];
      if (platform === 'amazon_us') {
        const result = await json('https://creatorsapi.amazon/catalog/v1/searchItems', {
          method: 'POST', headers: { Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json', 'x-marketplace': 'www.amazon.com' },
          body: JSON.stringify({ keywords: query.us, marketplace: 'www.amazon.com', partnerTag: env.AMAZON_US_TAG, itemCount: 10,
            searchIndex: 'All', sortBy: 'Relevance', condition: 'New', resources: ['itemInfo.title', 'images.primary.large', 'offersV2.listings.price', 'offersV2.listings.availability', 'offersV2.listings.condition', 'offersV2.listings.dealDetails', 'offersV2.listings.isBuyBoxWinner', 'offersV2.listings.type'] }),
        });
        items = result.searchResult?.items || [];
      } else {
        const result = await json(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query.br)}&limit=10`, { headers: { Authorization: `Bearer ${env.MERCADO_LIVRE_ACCESS_TOKEN}` } });
        items = (result.results || []).filter((item: any) => /^MLB\d+$/.test(item.id));
      }
      let selected = false;
      for (let item of items) {
        const externalId = platform === 'amazon_us' ? item.asin : item.id;
        if (chosen.some(row => row.platform === platform && row.externalId === externalId)) continue;
        try {
          if (platform === 'mercado_livre') item = await json(`https://api.mercadolibre.com/items/${item.id}`, { headers: { Authorization: `Bearer ${env.MERCADO_LIVRE_ACCESS_TOKEN}` } });
          const row = candidate(item, platform, query.category, env);
          row.imageUrl = await checkImage(row.imageUrl, platform);
          chosen.push(row); selected = true; break;
        } catch { /* Try the next result; never replace unverified fields with invented values. */ }
      }
      if (!selected) throw new Error(`no_verified_candidate:${platform}:${query.category}`);
    }
  }
  if (chosen.length !== 10) throw new Error('incomplete_seed');

  const client = postgres(env.DATABASE_URL!, { prepare: false, max: 1, ssl: { rejectUnauthorized: false }, connect_timeout: 10 });
  const db = drizzle(client);
  try {
    const rows = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(20260908, 10)`);
      const table = [];
      for (const row of chosen) {
        const inserted = await captureOfferInTransaction(tx, { ...row, inStock: true,
          referenceProvenance: row.platform === 'amazon_us' ? 'amazon:creators_api' : 'mercado_livre:items' });
        table.push({ Titulo: row.title, Marketplace: row.platform, Moeda: row.currency, 'Preco Original': row.originalPrice,
          'Preco Atual': row.currentPrice, 'Desconto %': inserted.discountPercentage });
      }
      return table;
    });
    console.table(rows);
    console.info('[seed] 10 ofertas processadas sem duplicar anúncios; transação confirmada.');
  } finally { await client.end({ timeout: 5 }); }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : '';
  // Do not log database connection strings, tokens, partner bodies or driver errors.
  console.error('[seed] Carga não concluída; nenhuma alteração parcial.', /^[a-zA-Z0-9_:, -]{1,400}$/.test(message) ? message : 'validation_or_service_error');
  process.exitCode = 1;
});
