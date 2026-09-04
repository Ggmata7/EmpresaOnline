export type AffiliateNetwork = 'amazon-br' | 'amazon-us' | 'mercado-livre' | 'aliexpress' | 'iherb' | 'generic';

const THIRD_PARTY_TRACKING_KEYS = [
  'tag', 'aff_id', 'affiliate_id', 'ref', 'ref_', 'linkCode', 'camp', 'creative',
];

export function sanitizeUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || THIRD_PARTY_TRACKING_KEYS.includes(key)) {
      url.searchParams.delete(key);
    }
  }
  url.hash = '';
  return url;
}

export function buildAffiliateUrl(input: {
  rawUrl: string;
  network: AffiliateNetwork;
  preGeneratedAffiliateUrl?: string;
}) {
  if (input.preGeneratedAffiliateUrl) {
    const generated = new URL(input.preGeneratedAffiliateUrl);
    if (generated.protocol !== 'https:') throw new Error('Affiliate URL must use HTTPS.');
    return generated.toString();
  }

  const url = sanitizeUrl(input.rawUrl);
  if (input.network === 'amazon-br') {
    url.searchParams.set('tag', process.env.AMAZON_BR_TAG ?? 'ggm0e-20');
    return url.toString();
  }
  if (input.network === 'amazon-us') {
    url.searchParams.set('tag', process.env.AMAZON_US_TAG ?? 'ggm0e7-20');
    return url.toString();
  }

  throw new Error(`A pre-generated affiliate URL is required for ${input.network}.`);
}
