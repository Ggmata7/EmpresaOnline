import type { Offer } from './offers';
export function lowestPriceFirst(a: { price: number; id: string }, b: { price: number; id: string }) {
  return a.price - b.price || a.id.localeCompare(b.id);
}
export function competitorFor(offer: Offer) {
  if (offer.isInternational || offer.region === 'global' || offer.currency !== 'BRL') return undefined;
  return offer.alternatives?.filter(item => item.network !== offer.network &&
    ['amazon-br', 'mercado-livre'].includes(item.network) && item.currency === 'BRL' &&
    Number.isFinite(item.price) && item.price > 0).sort(lowestPriceFirst)[0];
}
export function trackingHref(slug: string, id: string) {
  return `/api/c/${encodeURIComponent(slug)}?offer=${encodeURIComponent(id)}`;
}
