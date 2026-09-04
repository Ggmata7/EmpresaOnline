const trackingKeys = new Set(['tag', 'aff_id', 'affiliate_id', 'ref', 'ref_', 'linkCode', 'camp', 'creative']);

export function sanitizeUrl(rawUrl) {
  const url = new URL(rawUrl);
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || trackingKeys.has(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url;
}

export function buildAffiliateUrl({ rawUrl, platform, affiliateUrl }) {
  if (affiliateUrl && !affiliateUrl.includes('PASTE_LINK_')) {
    const generated = new URL(affiliateUrl);
    if (generated.protocol !== 'https:') throw new Error('Affiliate link must use HTTPS.');
    return generated.toString();
  }

  const url = sanitizeUrl(rawUrl);
  if (platform === 'AMAZON_BR') {
    url.searchParams.set('tag', process.env.AMAZON_BR_TAG || 'ggm0e-20');
    return url.toString();
  }
  if (platform === 'AMAZON_US') {
    url.searchParams.set('tag', process.env.AMAZON_US_TAG || 'ggm0e7-20');
    return url.toString();
  }

  throw new Error(`${platform} requires an official pre-generated affiliate deep link.`);
}

export function assertTagged(url, platform) {
  const parsed = new URL(url);
  if (platform === 'AMAZON_BR' && parsed.searchParams.get('tag') !== (process.env.AMAZON_BR_TAG || 'ggm0e-20')) throw new Error('Amazon BR tag missing.');
  if (platform === 'AMAZON_US' && parsed.searchParams.get('tag') !== (process.env.AMAZON_US_TAG || 'ggm0e7-20')) throw new Error('Amazon US tag missing.');
  if (!['AMAZON_BR', 'AMAZON_US'].includes(platform) && parsed.protocol !== 'https:') throw new Error('Invalid affiliate URL.');
  return url;
}
