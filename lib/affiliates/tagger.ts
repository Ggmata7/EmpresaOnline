export type Platform = 'amazon_br' | 'amazon_us' | 'mercado_livre';

const hosts: Record<Platform, string[]> = {
  amazon_br: ['amazon.com.br', 'www.amazon.com.br'],
  amazon_us: ['amazon.com', 'www.amazon.com'],
  mercado_livre: ['mercadolivre.com.br', 'www.mercadolivre.com.br', 'produto.mercadolivre.com.br'],
};

/** Attribution parameters are not a guarantee of commission eligibility. Shortlinks must be resolved first. */
export function tagAffiliateUrl(raw: string, platform: Platform): string {
  const source = new URL(raw);
  if (source.protocol !== 'https:' || source.username || source.password || source.port || !hosts[platform]?.includes(source.hostname)) {
    throw new Error('invalid_marketplace_url');
  }
  if (platform !== 'mercado_livre') {
    const asin = source.pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i)?.[1];
    if (!asin) throw new Error('amazon_asin_required');
    const url = new URL(`/dp/${asin.toUpperCase()}`, `https://www.amazon.${platform === 'amazon_br' ? 'com.br' : 'com'}`);
    url.searchParams.set('tag', platform === 'amazon_br' ? 'ggm0e-20' : 'ggm0e7-20');
    return url.toString();
  }
  if (!/\/MLB-?\d+(?:[-/]|$)/i.test(source.pathname)) throw new Error('mercado_livre_product_required');
  // Preserve variation identifiers, but never forward redirect destinations or conflicting tracking.
  for (const key of [...source.searchParams.keys()]) {
    if (!['variation', 'variation_id', 'attributes'].includes(key)) source.searchParams.delete(key);
  }
  source.hash = '';
  source.searchParams.set('matt_tool', '29240022');
  source.searchParams.set('matt_word', 'barrosgabriel20220204212655');
  source.searchParams.set('forceInApp', 'true');
  return source.toString();
}
