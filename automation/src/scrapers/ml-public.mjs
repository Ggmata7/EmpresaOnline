import { load } from 'cheerio';
import { UNIT_PRICE } from './price-guards.mjs';

export const ML_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1', 'Upgrade-Insecure-Requests': '1',
};

export const ML_CATEGORIES = ['MLB1648', 'MLB1574', 'MLB1246', 'MLB5672', 'MLB1430', 'MLB1276', 'MLB1196'];

export function mlProductLinks(html, base) {
  const $ = load(html), links = new Set();
  $('a[href], loc').each((_, node) => {
    try {
      const url = new URL($(node).attr('href') || $(node).text(), base);
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['www.mercadolivre.com.br', 'produto.mercadolivre.com.br'].includes(url.hostname) ||
        !/\/(?:p\/)?MLB-?\d+(?:[-/]|$)/i.test(url.pathname)) return;
      url.search = ''; url.hash = ''; links.add(url.toString());
    } catch { /* Ignore non-product links. */ }
  });
  return [...links];
}

export function parseMlProduct(html, source, parsePromotions, money) {
  const $ = load(html);
  const expected = new URL(source.url).pathname.match(/MLB-?\d+/i)?.[0].replace('-', '');
  const title = $('h1.ui-pdp-title').first().text().trim();
  const current = $('.ui-pdp-price__second-line .andes-money-amount').first();
  const original = $('.ui-pdp-price__original-value').first();
  const amount = node => UNIT_PRICE.test(node.text()) || UNIT_PRICE.test(node.parent().text()) ? null : money(node.attr('content') || `${node.find('.andes-money-amount__fraction').text()},${node.find('.andes-money-amount__cents').text() || '00'}`, 'BRL');
  const stock = /estoque dispon[ií]vel/i.test($('.ui-pdp-buybox, .ui-pdp-stock-information').text());
  const currency = current.find('.andes-money-amount__currency-symbol').text();
  const price = amount(current);
  if (!expected || !title || !stock || currency !== 'R$' || !price) return [];
  const data = { '@type': 'Product', name: title, url: source.url,
    image: $('meta[property="og:image"]').attr('content'),
    offers: { '@type': 'Offer', price, priceCurrency: 'BRL', availability: 'https://schema.org/InStock' } };
  const rows = parsePromotions(`<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`, source);
  return rows.filter(row => row.externalId === expected).map(row => ({ ...row,
    originalPrice: amount(original) > price ? amount(original) : price,
    priceEvidence: { parser: 'ml-public-v1', reference: amount(original), unitPriceExcluded: true } }));
}

export async function collectMlPublic(source, { fetchPage, parsePromotions, money, fetcher = fetch }) {
  let html;
  try { html = await fetchPage(source); }
  catch (error) {
    if (error.message !== 'http_403') throw error;
    // Public independent discovery only; no proxy, challenge solving or credentials reuse.
    const response = await fetcher('https://www.mercadolivre.com.br/sitemap.xml', {
      headers: ML_HEADERS, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error('page_too_large');
    html = await response.text();
    if (html.length > 2_000_000) throw new Error('page_too_large');
  }
  if (/\/MLB-?\d+(?:[-/]|$)/i.test(new URL(source.url).pathname)) return parseMlProduct(html, source, parsePromotions, money);
  // An explicit delivery promise on a public offer card is availability evidence.
  // Detail pages requiring account verification are never bypassed.
  const listed = parsePromotions(html, source);
  if (listed.length) return listed.map(row => ({ ...row,
    priceEvidence: { parser: 'ml-public-card-v1', reference: row.originalPrice, unitPriceExcluded: true } }));
  const rows = [];
  for (const url of mlProductLinks(html, source.url).slice(0, 150)) {
    try {
      const detail = { ...source, url };
      rows.push(...parseMlProduct(await fetchPage(detail), detail, parsePromotions, money));
    } catch (error) {
      if (/http_(401|403|429|503)|access_challenge/.test(error.message)) break;
    }
  }
  return rows;
}
