type Environment = Record<string, string | undefined>;
export type AffiliatePlatform = 'amazon_br' | 'amazon_us' | 'mercado_livre';

function safeUrl(raw: string, hosts: string[]) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) {
    throw new Error('affiliate_destination_not_allowed');
  }
  return url;
}

export function mercadoLivreLinks(env: Environment = process.env): Record<string, string> {
  let links: unknown;
  try { links = JSON.parse(env.MERCADO_LIVRE_AFFILIATE_LINKS_JSON || '{}'); }
  catch { throw new Error('invalid_mercado_livre_affiliate_map'); }
  if (!links || typeof links !== 'object' || Array.isArray(links) ||
      !Object.entries(links).every(([id, value]) => /^MLB\d+$/.test(id) && typeof value === 'string')) {
    throw new Error('invalid_mercado_livre_affiliate_map');
  }
  return links as Record<string, string>;
}

export function normalizeAffiliateUrl(raw: string, platform: AffiliatePlatform, env: Environment = process.env) {
  if (platform === 'amazon_br' || platform === 'amazon_us') {
    const domain = platform === 'amazon_br' ? 'amazon.com.br' : 'amazon.com';
    const url = safeUrl(raw, [domain, `www.${domain}`]);
    const asin = url.pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i)?.[1]?.toUpperCase();
    if (!asin) throw new Error('amazon_asin_missing');
    const tag = env[platform === 'amazon_br' ? 'AMAZON_BR_TAG' : 'AMAZON_US_TAG']?.trim();
    if (!tag || !/^[a-z0-9-]{3,64}$/i.test(tag)) throw new Error('amazon_tag_missing_or_invalid');
    const destination = new URL(`https://www.${domain}/dp/${asin}`);
    destination.searchParams.set('tag', tag);
    return { externalId: asin, url: destination.toString() };
  }
  if (platform !== 'mercado_livre') throw new Error('unsupported_marketplace');
  const url = safeUrl(raw, ['mercadolivre.com.br', 'www.mercadolivre.com.br', 'produto.mercadolivre.com.br']);
  const itemId = url.pathname.match(/MLB-?\d+/i)?.[0].replace('-', '').toUpperCase();
  if (!itemId) throw new Error('mercado_livre_listing_id_missing');
  // Only the affiliate portal supplies the account's genuine tracking parameters.
  // A public profile or API access token must never be substituted for an affiliate link.
  const official = mercadoLivreLinks(env)[itemId];
  if (!official) throw new Error(`official_affiliate_link_required_${itemId}`);
  const destination = safeUrl(official, ['mercadolivre.com.br', 'www.mercadolivre.com.br', 'produto.mercadolivre.com.br', 'mercadolivre.com', 'www.mercadolivre.com', 'meli.la']);
  return { externalId: itemId, url: destination.toString() };
}
