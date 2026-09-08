import { load } from 'cheerio';
import { readFile } from 'node:fs/promises';

export const SOURCES = [
  { platform: 'mercado_livre', currency: 'BRL', url: 'https://api.mercadolibre.com/sites/MLB/search?q=ofertas&limit=15' },
  { platform: 'amazon_br', currency: 'BRL', url: 'https://www.amazon.com.br/dp/B07DVJC66X' },
  { platform: 'amazon_us', currency: 'USD', url: 'https://www.amazon.com/dp/B000E2CVDI' },
];
const headers = {
  'User-Agent': process.env.COLLECTOR_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Accept: 'text/html,application/xhtml+xml;q=0.9',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1', 'Upgrade-Insecure-Requests': '1',
};

export function money(value, currency) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  let text = String(value ?? '').trim().replace(/(?:R\$|US\$|\$|BRL|USD|\s)/g, '');
  if (!text || /[^0-9.,]/.test(text)) return null;
  // Currency is not locale: amazon.com may return Portuguese decimal commas for USD.
  const decimal = text.match(/[.,](\d{2})$/);
  if (decimal) text = text.slice(0, -3).replace(/[.,]/g, '') + '.' + decimal[1];
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(text)) text = text.replace(/[.,]/g, '');
  else if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function category(title) {
  if (/creatina|whey|prote[ií]na|fitness|yoga|dumbbell|resistance band|halter|treino/i.test(title)) return 'Performance';
  if (/automotiv|pneu|car tire|inflator|compressor|dash.?cam|carregador veicular|oil filter|filtro.*[oó]leo/i.test(title)) return 'Automotivo';
  if (/vitamina|suplemento|omega|col[aá]geno/i.test(title)) return 'Longevidade';
  if (/mouse|teclado|keyboard|headphone|fone|earbud|tablet|notebook|laptop|smart|usb|charger|carregador|monitor|ssd|camera|c[aâ]mera|gadget|speaker|bluetooth|echo dot|fire tv/i.test(title)) return 'Tecnologia';
  return null;
}

export async function fetchPage(source, fetcher = fetch) {
  // Follow normal same-origin campaigns only, never login/challenge/off-domain redirects.
  let current = new URL(source.url), response;
  const signal = AbortSignal.timeout(20000);
  for (let hop = 0; hop <= 2; hop++) {
    response = await fetcher(current, { headers, redirect: 'manual', signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location) throw new Error('redirect_blocked');
    const next = new URL(location, current);
    if (next.origin !== new URL(source.url).origin || next.username || next.password ||
      !/^\/(events\/|deals(?:\/|$)|gp\/goldbox|ofertas(?:\/|$)|campanha\/)/.test(next.pathname)) throw new Error('redirect_blocked');
    await response.body?.cancel();
    current = next;
  }
  if (!response.ok) throw new Error(`http_${response.status}`);
  if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('not_html');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 8_000_000) throw new Error('page_too_large');
    chunks.push(chunk);
  }
  const html = Buffer.concat(chunks).toString('utf8');
  if (/validateCaptcha|captchaInput|robot check|automated access|unusual traffic|verifique que voc[eê] [eé] humano/i.test(html)) throw new Error('access_challenge');
  return html;
}

export function parsePromotions(html, source) {
  const $ = load(html), candidates = [];
  function add(row) {
    const title = String(row.title || '').replace(/\s+/g, ' ').trim();
    const group = category(title);
    if (!group) return;
    row.originalPrice ??= row.currentPrice; // Unknown reference price is zero discount, never an invented margin.
    if (!row.inStock || !row.currentPrice || !row.originalPrice || row.originalPrice < row.currentPrice || row.currency !== source.currency) return;
    try {
      const url = new URL(row.sourceUrl, source.url);
      const allowed = source.platform === 'mercado_livre'
        ? ['www.mercadolivre.com.br', 'mercadolivre.com.br', 'produto.mercadolivre.com.br']
        : [new URL(source.url).hostname, new URL(source.url).hostname.replace('www.', '')];
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed.includes(url.hostname)) return;
      const externalId = source.platform === 'mercado_livre'
        ? url.pathname.match(/\/MLB-?\d+(?=[-/]|$)/i)?.[0].slice(1).replace('-', '').toUpperCase()
        : url.pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i)?.[1].toUpperCase();
      if (!externalId) return;
      const image = new URL(row.imageUrl);
      const imageHosts = source.platform === 'mercado_livre' ? ['http2.mlstatic.com'] : ['m.media-amazon.com', 'images-na.ssl-images-amazon.com'];
      if (image.protocol !== 'https:' || image.username || image.password || image.port || !imageHosts.includes(image.hostname)) return;
      url.search = ''; url.hash = '';
      candidates.push({ title, category: group, imageUrl: image.toString(), sourceUrl: url.toString(), externalId,
        platform: source.platform, currency: source.currency, originalPrice: row.originalPrice, currentPrice: row.currentPrice,
        inStock: true, checkedAt: new Date(), expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        referenceProvenance: `public_promo:${source.platform}` });
    } catch { /* Incomplete or unsafe cards are not offers. */ }
  }
  function visit(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 15) return;
    if (Array.isArray(node)) { node.forEach(value => visit(value, depth + 1)); return; }
    if ([node['@type']].flat().includes('Product')) {
      for (const offer of [node.offers].flat().filter(Boolean)) {
        // Aggregate low/high prices are different sellers/variants, not a discount anchor.
        if (offer['@type'] === 'AggregateOffer') continue;
        const specs = [offer.priceSpecification].flat().filter(Boolean);
        const original = specs.find(spec => /StrikethroughPrice|ListPrice/.test(spec.priceType || ''));
        const price = value => /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : null;
        add({ title: node.name, imageUrl: Array.isArray(node.image) ? node.image[0] : node.image?.url || node.image,
          sourceUrl: offer.url || node.url, currency: offer.priceCurrency, currentPrice: price(offer.price),
          originalPrice: price(original?.price), inStock: /\/InStock$/.test(offer.availability || '') });
      }
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value, depth + 1);
  }
  $('script[type="application/ld+json"]').each((_, element) => {
    try { visit(JSON.parse($(element).text())); } catch { /* Malformed block only. */ }
  });
  const ml = source.platform === 'mercado_livre';
  $(ml ? '.poly-card, .promotion-item, .ui-search-result' : '[data-asin], [data-testid="product-card"]').each((_, element) => {
    const card = $(element);
    const link = card.find(ml ? 'a.poly-component__title, a.promotion-item__link-container, a.ui-search-link' : 'a[href*="/dp/"], a[href*="/gp/product/"]').first();
    const priceNode = ml ? card.find('.poly-price__current .andes-money-amount, .promotion-item__price').first() : card.find('.a-price:not(.a-text-price) .a-offscreen').first();
    const oldNode = card.find(ml ? 's.andes-money-amount, .promotion-item__oldprice' : '.a-price.a-text-price .a-offscreen').first();
    const mlMoney = node => {
      const fraction = node.find('.andes-money-amount__fraction').text();
      const cents = node.find('.andes-money-amount__cents').text();
      return money(fraction ? `${fraction}${cents ? ',' + cents : ''}` : node.text(), source.currency);
    };
    const text = card.text();
    const available = /comprar|adicionar ao carrinho|add to cart|buy now/i.test(card.find('button, [role="button"], input[type="submit"]').text()) || card.find('[content="https://schema.org/InStock"]').length > 0;
    add({ title: card.find(ml ? '.poly-component__title, .promotion-item__title, .ui-search-item__title' : 'h2, [data-testid="product-card-title"]').first().text() || link.attr('title'),
      imageUrl: card.find('img').first().attr('data-src') || card.find('img').first().attr('src'), sourceUrl: link.attr('href'),
      currentPrice: ml ? mlMoney(priceNode) : money(priceNode.text(), source.currency),
      originalPrice: ml ? mlMoney(oldNode) : money(oldNode.text(), source.currency), currency: source.currency,
      inStock: available && !/esgotado|indispon[ií]vel|out of stock|currently unavailable|prime exclusive|somente prime|subscribe|assinatura/i.test(text) });
  });
  return [...new Map(candidates.map(row => [row.externalId, row])).values()];
}

export function parseMercadoLivreSearch(payload) {
  if (!Array.isArray(payload?.results)) throw new Error('invalid_search_payload');
  const products = payload.results.filter(item => /^MLB\d+$/.test(item.id) && item.currency_id === 'BRL' &&
    item.condition === 'new' && Number.isFinite(item.available_quantity) && item.available_quantity > 0 &&
    (item.status === undefined || item.status === 'active') && Number.isFinite(item.price) && item.price > 0)
    .map(item => {
      let image = item.thumbnail;
      try { const url = new URL(image); if (url.hostname === 'http2.mlstatic.com') { url.protocol = 'https:'; image = url.toString(); } } catch { /* Validator rejects it. */ }
      return { '@type': 'Product', name: item.title, image, url: item.permalink,
        offers: { '@type': 'Offer', price: item.price, priceCurrency: item.currency_id, availability: 'https://schema.org/InStock',
          priceSpecification: { priceType: 'https://schema.org/ListPrice', price: item.original_price ?? item.price } } };
    });
  const parsed = parsePromotions(`<script type="application/ld+json">${JSON.stringify(products).replaceAll('<', '\\u003c')}</script>`, SOURCES[0]);
  return parsed.filter(row => payload.results.some(item => item.id === row.externalId));
}

export function parseAmazonProduct(html, source) {
  const requestedAsin = new URL(source.url).pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  if (!requestedAsin) return [];
  const $ = load(html);
  const declaredAsin = $('#ASIN').attr('value');
  if (declaredAsin && declaredAsin !== requestedAsin) return [];
  const structured = parsePromotions(html, source).filter(row => row.externalId === requestedAsin);
  if (structured.length) return structured.slice(0, 1);
  const title = $('#productTitle').text().trim() || $('meta[property="og:title"]').attr('content');
  const image = $('#landingImage').attr('data-old-hires') || $('#landingImage').attr('src') || $('meta[property="og:image"]').attr('content');
  const priceBox = $('#corePriceDisplay_desktop_feature_div, #corePrice_feature_div').first();
  const priceNode = priceBox.find('.a-price:not(.a-text-price)').first();
  // Only the main purchase price; recommendations, installments and subscriptions are excluded.
  const priceText = priceNode.find('.a-offscreen').first().text() ||
    `${priceNode.find('.a-price-whole').text().replace(/[.,]$/, '')}${source.currency === 'BRL' ? ',' : '.'}${priceNode.find('.a-price-fraction').text() || '00'}`;
  const currencyMeta = $('meta[property="product:price:currency"], meta[itemprop="priceCurrency"]').first().attr('content');
  const symbol = priceNode.find('.a-price-symbol').text() || priceText;
  if (currencyMeta && currencyMeta !== source.currency) return [];
  if (!currencyMeta && !(source.currency === 'BRL' ? /R\$/.test(symbol) : /\$/.test(symbol) && !/R\$/.test(symbol))) return [];
  if (/prime exclusive|somente prime|subscribe|assinatura|programe e poupe/i.test(priceBox.text())) return [];
  const availability = $('#availability').text();
  const available = /em estoque|in stock|dispon[ií]vel/i.test(availability) && !/indispon[ií]vel|unavailable|out of stock/i.test(availability);
  if (!available) return [];
  const currentPrice = money(priceText, source.currency);
  const originalPrice = money(priceBox.find('.a-text-price .a-offscreen, .basisPrice .a-offscreen').first().text(), source.currency) ?? currentPrice;
  const data = { '@type': 'Product', name: title, image, url: source.url,
    offers: { '@type': 'Offer', price: currentPrice, priceCurrency: source.currency, availability: 'https://schema.org/InStock',
      priceSpecification: { priceType: 'https://schema.org/ListPrice', price: originalPrice } } };
  return parsePromotions(`<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`, source);
}

export async function configuredSources() {
  const watchlist = JSON.parse(await readFile(new URL('../../config/amazon-watchlist.json', import.meta.url), 'utf8'));
  return [SOURCES[0], ...['amazon_br', 'amazon_us'].flatMap(platform => {
    const asins = watchlist[platform];
    if (!Array.isArray(asins) || !asins.every(asin => /^[A-Z0-9]{10}$/.test(asin))) throw new Error('invalid_watchlist');
    return [...new Set(asins)].slice(0, 20).map(asin => ({ platform, currency: platform === 'amazon_br' ? 'BRL' : 'USD',
      url: `https://www.amazon.${platform === 'amazon_br' ? 'com.br' : 'com'}/dp/${asin}` }));
  })];
}

export async function collectPromotions({ fetcher = fetch, sources = SOURCES } = {}) {
  const rows = [], diagnostics = [];
  const blockedPlatforms = new Set();
  for (const source of sources) {
    if (blockedPlatforms.has(source.platform)) {
      diagnostics.push({ platform: source.platform, status: 'skipped_after_block', captured: 0 });
      continue;
    }
    try {
      let offers;
      if (source.platform === 'mercado_livre') {
        const response = await fetcher(source.url, { headers: { Accept: 'application/json', 'Accept-Language': 'pt-BR' },
          redirect: 'error', signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`http_${response.status}`);
        offers = parseMercadoLivreSearch(await response.json());
      } else {
        offers = parseAmazonProduct(await fetchPage(source, fetcher), source);
      }
      rows.push(...offers);
      diagnostics.push({ platform: source.platform, status: offers.length ? 'collected' : 'no_verified_offers', captured: offers.length });
    } catch (error) {
      if (/^(http_(401|403|429|503)|access_challenge)$/.test(error.message)) blockedPlatforms.add(source.platform);
      diagnostics.push({ platform: source.platform, status: 'unavailable', captured: 0,
        reason: /^(http_\d{3}|not_html|page_too_large|access_challenge|redirect_blocked)$/.test(error.message) ? error.message : 'network_error' });
    }
  }
  return { rows: [...new Map(rows.map(row => [`${row.platform}:${row.externalId}`, row])).values()], diagnostics };
}

export async function runPublicCollector() {
  if (!process.env.DATABASE_URL) throw new Error('database_url_missing');
  const { rows, diagnostics } = await collectPromotions({ sources: await configuredSources() });
  console.table(diagnostics);
  const summary = { productsCreated: 0, offersCreated: 0, offersUpdated: 0, persisted: 0 };
  if (!rows.length) {
    console.table([summary]);
    console.warn('[collector] Nenhuma oferta verificável; catálogo preservado.');
    return { ...summary, diagnostics };
  }
  const [{ default: postgres }, { drizzle }, { sql }, { captureOfferInTransaction }] = await Promise.all([
    import('postgres'), import('drizzle-orm/postgres-js'), import('drizzle-orm'), import('../../../lib/deals/dedup.ts'),
  ]);
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false }, connect_timeout: 10,
    connection: { statement_timeout: 30000, lock_timeout: 10000 } });
  try {
    const persisted = await drizzle(client).transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(20260908, 11)`);
      const log = [], counts = new Map();
      for (const row of rows.sort((a, b) => (1 - b.currentPrice / b.originalPrice) - (1 - a.currentPrice / a.originalPrice))) {
        const key = `${row.platform === 'amazon_us' ? 'us' : 'br'}:${row.category}`;
        if ((counts.get(key) || 0) >= 20) continue;
        const [before] = await tx.execute(sql`select (select count(*)::int from public.products) as products,
          exists(select 1 from public.offers where platform = ${row.platform} and external_id = ${row.externalId}) as existing`);
        const offer = await captureOfferInTransaction(tx, row);
        const [after] = await tx.execute(sql`select count(*)::int as products from public.products`);
        summary.productsCreated += after.products - before.products;
        summary[before.existing ? 'offersUpdated' : 'offersCreated']++;
        summary.persisted++;
        counts.set(key, (counts.get(key) || 0) + 1);
        log.push({ title: row.title, platform: row.platform, currency: row.currency, price: row.currentPrice, offerId: offer.id });
      }
      return log;
    });
    // Re-read committed rows: the log describes database state, not merely attempted inserts.
    const ids = persisted.map(row => row.offerId);
    const confirmed = ids.length ? await client`select p.title, p.is_international, o.platform, o.currency,
      o.original_price, o.current_price, o.discount_percentage, o.id as offer_id
      from public.offers o join public.products p on p.id = o.product_id where o.id in ${client(ids)}` : [];
    console.table(confirmed);
    console.table([summary]);
    return { ...summary, diagnostics, confirmed: confirmed.length };
  } finally { await client.end({ timeout: 5 }); }
}
