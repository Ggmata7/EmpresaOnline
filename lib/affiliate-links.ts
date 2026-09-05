import type { Marketplace } from './offers';

export type AffiliateNetwork = Marketplace;
const TRACKING_KEYS = new Set(['tag', 'aff_id', 'affiliate_id', 'ref', 'ref_', 'linkcode', 'camp', 'creative']);
const HOSTS: Record<Marketplace, readonly string[]> = {
  'amazon-br': ['amazon.com.br', 'www.amazon.com.br'],
  'amazon-us': ['amazon.com', 'www.amazon.com'],
  'mercado-livre': ['mercadolivre.com.br', 'www.mercadolivre.com.br', 'produto.mercadolivre.com.br', 'mercadolivre.com', 'www.mercadolivre.com', 'meli.la'],
};

function validatedUrl(raw: string, network: Marketplace) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !HOSTS[network]?.includes(url.hostname)) {
    throw new Error('Affiliate destination is outside the authorized marketplace.');
  }
  return url;
}

export function sanitizeUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_KEYS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.hash = '';
  return url;
}

export function buildAffiliateUrl(input: { rawUrl: string; network: Marketplace; preGeneratedAffiliateUrl?: string }) {
  const source = validatedUrl(input.rawUrl, input.network);
  if (input.network === 'mercado-livre') {
    if (!input.preGeneratedAffiliateUrl) throw new Error('Mercado Livre requires an official pre-generated affiliate link.');
    return validatedUrl(input.preGeneratedAffiliateUrl, input.network).toString();
  }
  // Keep only a product destination; never forward an external redirect query or another associate's tag.
  const asin = source.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
  if (!asin) throw new Error('An Amazon product URL with a valid ASIN is required.');
  const destination = new URL(`/dp/${asin.toUpperCase()}`, source.origin);
  const tag = input.network === 'amazon-br'
    ? process.env.AMAZON_BR_TAG || 'ggm0e-20'
    : process.env.AMAZON_US_TAG || 'ggm0e7-20';
  if (!/^[a-zA-Z0-9-]{3,64}$/.test(tag)) throw new Error('Invalid Amazon associate tag configuration.');
  destination.searchParams.set('tag', tag);
  return destination.toString();
}

export type RedirectCandidate = {
  id: string;
  productId: string;
  network: Marketplace;
  price: number;
  currency: 'BRL' | 'USD';
  shippingCost?: number | null;
  availability: 'in_stock' | 'unknown' | 'out_of_stock';
  expiresAt?: string;
  sourceUrl: string;
  affiliateUrl?: string;
  analyticsSource: 'legacy' | 'normalized';
};

export function validSlug(slug: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,179}$/.test(slug);
}

export function validOfferId(id: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
}

export function selectRedirectOffer(candidates: RedirectCandidate[], country?: string, selectedId?: string, now = Date.now()) {
  const active = candidates.filter((offer) => Number.isFinite(offer.price) && offer.price > 0 &&
    offer.availability !== 'out_of_stock' && (!offer.expiresAt || Date.parse(offer.expiresAt) > now));
  if (selectedId) return active.find((offer) => offer.id === selectedId) ?? null;
  if (!country) return null;
  const regional = active.filter((offer) => country === 'BR'
    ? offer.currency === 'BRL' && (offer.network === 'amazon-br' || offer.network === 'mercado-livre')
    : offer.currency === 'USD' && offer.network === 'amazon-us');
  // Known landed totals take precedence. Unknown shipping cannot truthfully be ranked as zero.
  return regional.sort((a, b) => {
    const aKnown = Number.isFinite(a.shippingCost) && a.shippingCost != null && a.shippingCost >= 0;
    const bKnown = Number.isFinite(b.shippingCost) && b.shippingCost != null && b.shippingCost >= 0;
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    return (a.price + (aKnown ? a.shippingCost! : 0)) - (b.price + (bKnown ? b.shippingCost! : 0)) || a.id.localeCompare(b.id);
  })[0] ?? null;
}
