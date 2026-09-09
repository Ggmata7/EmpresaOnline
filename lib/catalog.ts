import 'server-only';

import { categoryFromDatabase, limitOffersPerCategory, networkFromDatabase, retailerFromDatabase, type Offer, type Region } from '@/lib/offers';
import { buildAffiliateUrl, type RedirectCandidate } from '@/lib/affiliate-links';
import { lowestPriceFirst } from '@/lib/product-comparison';
import { validCoupon } from '@/lib/deals/coupon';
import { titlesMatch } from '@/lib/deals/match';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

type LegacyRow = {
  id: string; slug: string; plataforma: string; titulo: string; categoria: string; subcategoria: string;
  regiao: 'BRASIL' | 'GLOBAL'; moeda: 'BRL' | 'USD'; url_original: string; url_afiliado: string;
  imagem_url: string | null; avaliacao: number | string | null; preco_atual: number | string;
  preco_medio_30d: number | string; oferta_valida_ate: string | null; atualizado_em: string;
  cupons?: Array<{ codigo: string; valido_ate: string | null; ativo: boolean }>;
};
type ProductRow = {
  is_international: boolean;
  id: string; slug: string; title: string; category: Offer['category']; subcategory: string; image_url: string | null;
};
type NormalizedRow = {
  id: string; product_id: string; platform: string; source_url: string; affiliate_url: string | null;
  original_price: number | string | null; current_price: number | string; currency: 'BRL' | 'USD';
  verified_coupon?: unknown;
  reference_price_kind: string; history_verified_at: string | null; rating: number | string | null;
  rating_count: number | null; shipping_price: number | string | null; shipping_label: string | null;
  in_stock: boolean | null; last_checked_at: string | null; expires_at: string | null; products: ProductRow;
};
type CatalogEntry = { display: Offer; destination: RedirectCandidate };
const legacySelect = 'id,slug,plataforma,titulo,categoria,subcategoria,regiao,moeda,url_original,url_afiliado,imagem_url,avaliacao,preco_atual,preco_medio_30d,oferta_valida_ate,atualizado_em,cupons(codigo,valido_ate,ativo)';
const normalizedSelect = 'id,product_id,platform,source_url,affiliate_url,original_price,current_price,currency,verified_coupon,reference_price_kind,history_verified_at,rating,rating_count,shipping_price,shipping_label,in_stock,last_checked_at,expires_at,products!inner(id,slug,title,category,subcategory,image_url,is_international)';

export class CatalogUnavailableError extends Error {}

function config(normalized = false) {
  const endpoint = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || (!normalized && (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  if (!endpoint || !key) throw new CatalogUnavailableError('Catalog environment is incomplete.');
  return { endpoint: endpoint.replace(/\/$/, ''), key };
}

function validPrice(value: unknown): number | undefined {
  const number = value == null ? NaN : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function discount(price: number, reference: number) {
  return reference > price ? Math.max(0, Math.min(99, Math.round((1 - price / reference) * 100))) : 0;
}

function displayable(entry: CatalogEntry) {
  const offer = entry.display;
  if (!Number.isFinite(offer.price) || offer.price <= 0 || offer.availability === 'out_of_stock' ||
    (offer.expiresAt && !(Date.parse(offer.expiresAt) > Date.now()))) return false;
  try {
    buildAffiliateUrl({ rawUrl: entry.destination.sourceUrl, network: entry.destination.network, preGeneratedAffiliateUrl: entry.destination.affiliateUrl });
    return true;
  } catch { return false; }
}

function fromLegacy(row: LegacyRow): CatalogEntry | null {
  const network = networkFromDatabase(row.plataforma);
  if (!network || (network === 'amazon-us' ? row.moeda !== 'USD' : row.moeda !== 'BRL')) return null;
  const coupon = row.cupons?.find((item) => item.ativo && (!item.valido_ate || Date.parse(item.valido_ate) > Date.now()));
  const price = Number(row.preco_atual);
  const reference = validPrice(row.preco_medio_30d) ?? price;
  const display: Offer = {
    id: row.id, productId: row.id, slug: row.slug, region: network === 'amazon-us' ? 'global' : 'brasil',
    category: categoryFromDatabase(row.categoria, row.subcategoria, row.titulo), subcategory: row.subcategoria,
    title: row.titulo, retailer: retailerFromDatabase(row.plataforma), oldPrice: reference, price, currency: row.moeda,
    coupon: coupon?.codigo, expiresAt: row.oferta_valida_ate || undefined, imageUrl: row.imagem_url || undefined,
    rating: validPrice(row.avaliacao), network, priceBasis: 'list', availability: 'unknown',
    // Legacy imports sometimes put a retailer list price into preco_medio_30d: never advertise this as history.
    verified: Boolean(row.atualizado_em), verifiedAt: row.atualizado_em, lastChecked: row.atualizado_em,
    discountPercent: discount(price, reference), shippingCost: null,
  };
  return { display, destination: { id: row.id, productId: row.id, network, price, currency: row.moeda,
    availability: 'unknown', expiresAt: display.expiresAt, sourceUrl: row.url_original,
    affiliateUrl: row.url_afiliado || undefined, analyticsSource: 'legacy' } };
}

function fromNormalized(row: NormalizedRow): CatalogEntry | null {
  const network = networkFromDatabase(row.platform);
  if (!network || !row.products || (network === 'amazon-us' ? row.currency !== 'USD' : row.currency !== 'BRL')) return null;
  if (row.products.is_international !== (network === 'amazon-us')) return null;
  const coupon = validCoupon(row.verified_coupon, Number(row.current_price));
  const price = coupon?.price ?? Number(row.current_price);
  const reference = validPrice(row.original_price) ?? price;
  const historyVerifiedAt = row.reference_price_kind === 'average_30d' ? row.history_verified_at || undefined : undefined;
  const availability = row.in_stock === true ? 'in_stock' : row.in_stock === false ? 'out_of_stock' : 'unknown';
  const shippingCost = validPrice(row.shipping_price) ?? null;
  const expiresAt = coupon ? new Date(Math.min(Date.parse(coupon.validUntil), row.expires_at ? Date.parse(row.expires_at) : Infinity)).toISOString() : row.expires_at || undefined;
  const display: Offer = {
    id: row.id, productId: row.product_id, slug: row.products.slug, region: network === 'amazon-us' ? 'global' : 'brasil',
    isInternational: row.products.is_international,
    category: categoryFromDatabase(row.products.category, row.products.subcategory || '', row.products.title), subcategory: row.products.subcategory || '', title: row.products.title,
    retailer: retailerFromDatabase(row.platform), imageUrl: row.products.image_url || undefined,
    coupon: coupon?.code,
    price, oldPrice: reference, currency: row.currency, network, priceBasis: historyVerifiedAt ? 'history30d' : 'list',
    historyVerifiedAt, rating: validPrice(row.rating), ratingCount: row.rating_count ?? undefined,
    shippingCost, shippingLabel: row.shipping_label || undefined, availability,
    lastChecked: row.last_checked_at || undefined, verifiedAt: row.last_checked_at || undefined,
    verified: Boolean(row.last_checked_at), expiresAt, discountPercent: discount(price, reference),
  };
  return { display, destination: { id: row.id, productId: row.product_id, network, price, currency: row.currency,
    shippingCost, availability, expiresAt: display.expiresAt, sourceUrl: row.source_url,
    affiliateUrl: row.affiliate_url || undefined, analyticsSource: 'normalized' } };
}

async function requestRows(normalized: boolean, slug?: string, region?: Region): Promise<CatalogEntry[] | null> {
  if (normalized && process.env.DATABASE_URL) {
    // Server-only database reads avoid depending on an additional REST service key.
    const rows = await getDb().execute<{ row: NormalizedRow }>(sql`
      select to_jsonb(o) || jsonb_build_object('products', to_jsonb(p)) as row
      from public.offers o join public.products p on p.id = o.product_id
      where o.is_active = true and o.current_price > 0
        and ${slug ? sql`p.slug = ${slug}` : sql`true`}
        and ${region === 'global' ? sql`o.platform = 'amazon_us'` : region === 'brasil' ? sql`o.platform in ('amazon_br', 'mercado_livre')` : sql`true`}
      order by o.discount_percentage desc, o.id limit 1000`);
    const entries = rows.map(({ row }) => fromNormalized(row)).filter((entry): entry is CatalogEntry => Boolean(entry));
    return slug ? entries : entries.filter(displayable);
  }
  const { endpoint, key } = config(normalized);
  const params = new URLSearchParams({ select: normalized ? normalizedSelect : legacySelect, limit: '1000' });
  if (normalized) {
    params.set('is_active', 'eq.true');
    params.set('current_price', 'gt.0');
    params.set('platform', region === 'brasil' ? 'in.(amazon_br,mercado_livre)' : region === 'global' ? 'eq.amazon_us' : 'in.(amazon_br,amazon_us,mercado_livre)');
    params.set('order', 'discount_percentage.desc');
    if (slug) params.set('products.slug', `eq.${slug}`);
  } else {
    params.set('ativo', 'eq.true');
    params.set('preco_atual', 'gt.0');
    params.set('plataforma', region === 'brasil' ? 'in.(AMAZON_BR,MERCADO_LIVRE)' : region === 'global' ? 'eq.AMAZON_US' : 'in.(AMAZON_BR,AMAZON_US,MERCADO_LIVRE)');
    params.set('order', 'desconto_real_percentual.desc');
    if (slug) params.set('slug', `eq.${slug}`);
  }
  let response: Response;
  try {
    response = await fetch(`${endpoint}/rest/v1/${normalized ? 'offers' : 'produtos'}?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      ...(slug ? { cache: 'no-store' as const } : { next: { revalidate: 900, tags: ['catalog'] } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { throw new CatalogUnavailableError('Catalog request failed.'); }
  if (!response.ok) {
    // Only an absent table/column allows an additive migration fallback. An empty v2 catalog stays empty.
    if (normalized) {
      const error = await response.json().catch(() => ({}));
      if (['PGRST205', 'PGRST200', 'PGRST204', '42P01', '42703'].includes(error.code)) return null;
    }
    throw new CatalogUnavailableError(`Catalog fetch failed (${response.status}).`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new CatalogUnavailableError('Catalog response is malformed.');
  const entries = rows.map(normalized ? fromNormalized : fromLegacy).filter((entry): entry is CatalogEntry => Boolean(entry));
  return slug ? entries : entries.filter(displayable);
}

async function loadEntries(slug?: string, region?: Region) {
  if (process.env.CATALOG_SCHEMA_VERSION !== '1') {
    const entries = await requestRows(true, slug, region);
    if (entries?.length === 0 && slug && process.env.DATABASE_URL) {
      // Preserve historical slugs after a conservative national-product merge.
      const [old] = await getDb().execute<{ title: string }>(sql`select title from public.products where slug=${slug} and is_international=false limit 1`);
      if (old) {
        const matches = (await requestRows(true, undefined, 'brasil') || []).filter(entry => titlesMatch(old.title, entry.display.title));
        if (new Set(matches.map(entry => entry.display.productId)).size === 1) return matches;
      }
    }
    if (entries) return entries;
  }
  return await requestRows(false, slug, region) || [];
}

function groupProducts(entries: CatalogEntry[]) {
  const groups = new Map<string, CatalogEntry[]>();
  for (const entry of entries.filter(displayable)) {
    const identity = entry.display.isInternational ? entry.display.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : entry.display.productId;
    const key = `${identity}:${entry.display.region}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return Array.from(groups.values()).map((group) => {
    const best = [...group].sort((a, b) => lowestPriceFirst(a.display, b.display))[0];
    return { ...best.display, alternatives: group.map(({ display }) => ({
      coupon: display.coupon, id: display.id, retailer: display.retailer, network: display.network, price: display.price,
      currency: display.currency as 'BRL' | 'USD', shippingCost: display.shippingCost,
      shippingLabel: display.shippingLabel, lastChecked: display.lastChecked,
    })) };
  });
}

export async function loadOffers(region?: Region): Promise<Offer[]> {
  try {
    // Fetch regions separately so a large BR catalog cannot crowd out the US in the database's result cap.
    const entries = region ? await loadEntries(undefined, region) : (await Promise.all([
      loadEntries(undefined, 'brasil'), loadEntries(undefined, 'global'),
    ])).flat();
    return limitOffersPerCategory(groupProducts(entries));
  } catch (error) {
    console.error('Catalog unavailable:', error instanceof CatalogUnavailableError ? error.message : 'unexpected response');
    return [];
  }
}

export async function loadRedirectCandidates(slug: string) {
  return (await loadEntries(slug)).map((entry) => entry.destination);
}

export async function loadOfferBySlug(slug: string): Promise<Offer | null> {
  return groupProducts(await loadEntries(slug))[0] || null;
}
