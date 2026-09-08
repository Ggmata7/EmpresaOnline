import test from 'node:test';
import assert from 'node:assert/strict';
import { money, parsePromotions, collectPromotions, fetchPage, SOURCES, parseMercadoLivreSearch, parseAmazonProduct } from '../src/scrapers/promo-collector.mjs';

test('localized prices do not confuse thousands, cents or installment text', () => {
  assert.equal(money('R$ 1.299,90', 'BRL'), 1299.9);
  assert.equal(money('$1,299.90', 'USD'), 1299.9);
  assert.equal(money('US$ 15,99', 'USD'), 15.99);
  assert.equal(money('$1.299,90', 'USD'), 1299.9);
  assert.equal(money('1,299', 'USD'), 1299);
  assert.equal(money('10x R$ 99,90', 'BRL'), null);
  assert.equal(money('', 'BRL'), null);
});
const product = overrides => ({ '@type': 'Product', name: 'Mouse Logitech M280 Preto',
  image: 'https://http2.mlstatic.com/D_test.webp', url: 'https://produto.mercadolivre.com.br/MLB-12345-mouse',
  offers: { '@type': 'Offer', price: '89.90', priceCurrency: 'BRL', availability: 'https://schema.org/InStock',
    priceSpecification: { price: '119.90', priceType: 'https://schema.org/StrikethroughPrice' } }, ...overrides });
const html = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
test('extracts only verified discounted Product offers; duplicate listings collapse', () => {
  const rows = parsePromotions(html({ '@graph': [product(), product()] }), SOURCES[0]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].currentPrice, 89.9);
  assert.equal(rows[0].externalId, 'MLB12345');
  assert.equal(rows[0].category, 'Eletrônicos, Celulares e Informática');
});
test('rejects absent stock, non-discounts, seller price ranges and unsafe URLs', () => {
  const base = product();
  for (const invalid of [product({ offers: { ...base.offers, availability: undefined } }),
    product({ offers: { ...base.offers, '@type': 'AggregateOffer' } }),
    product({ url: 'https://evil.test/MLB12345' }), product({ image: 'https://evil.test/image.jpg' })]) {
    assert.equal(parsePromotions(html(invalid), SOURCES[0]).length, 0);
  }
});
test('US electronics are USD and remain separate from domestic offers', () => {
  const p = product({ image: 'https://m.media-amazon.com/images/I/test.jpg', url: 'https://www.amazon.com/dp/B000E2CVDI' });
  p.offers.priceCurrency = 'USD';
  assert.equal(parsePromotions(html(p), SOURCES[2])[0].platform, 'amazon_us');
  assert.equal(parsePromotions(html(p), SOURCES[1]).length, 0);
});
test('blocks do not trigger retries or database writes; diagnostics show every source', async () => {
  let calls = 0;
  const result = await collectPromotions({ fetcher: async () => { calls++; return new Response('', { status: 403 }); } });
  assert.equal(calls, 3);
  assert.equal(result.rows.length, 0);
  assert.equal(result.diagnostics.every(row => row.reason === 'http_403'), true);
  await assert.rejects(fetchPage(SOURCES[0], async () => new Response('robot check', { headers: { 'content-type': 'text/html' } })), /access_challenge/);
});

test('follows public campaign redirects but rejects login redirects', async () => {
  let calls = 0;
  const response = await fetchPage(SOURCES[1], async () => ++calls === 1
    ? new Response(null, { status: 302, headers: { location: '/events/ofertasmensais' } })
    : new Response('<html>campaign</html>', { headers: { 'content-type': 'text/html' } }));
  assert.match(response, /campaign/);
  assert.equal(calls, 2);
  await assert.rejects(fetchPage(SOURCES[1], async () => new Response(null, { status: 302, headers: { location: '/ap/signin' } })), /redirect_blocked/);
});

test('ML JSON without original price uses current price, not a fabricated margin', () => {
  const item = { id: 'MLB12345', title: 'Mouse Logitech M280 Preto', price: 90, currency_id: 'BRL',
    condition: 'new', available_quantity: 3, thumbnail: 'http://http2.mlstatic.com/test.jpg',
    permalink: 'https://produto.mercadolivre.com.br/MLB-12345-mouse' };
  const rows = parseMercadoLivreSearch({ results: [item] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].originalPrice, 90);
  assert.equal(rows[0].imageUrl, 'https://http2.mlstatic.com/test.jpg');
  assert.equal(parseMercadoLivreSearch({ results: [{ ...item, available_quantity: 0 }] }).length, 0);
  assert.equal(parseMercadoLivreSearch({ results: [{ ...item, currency_id: 'USD' }] }).length, 0);
});
test('canonical Amazon extracts only the main price and verifies the ASIN and stock', () => {
  const page = `<input id="ASIN" value="B07DVJC66X"><span id="productTitle">Creatina Max Titanium 300g</span>
    <img id="landingImage" src="https://m.media-amazon.com/images/I/test.jpg">
    <div id="availability">Em estoque</div><div id="corePrice_feature_div">
    <span class="a-price"><span class="a-price-symbol">R$</span><span class="a-price-whole">99,</span><span class="a-price-fraction">90</span></span></div>
    <div id="recommendations"><span class="a-offscreen">R$ 1,00</span></div>`;
  const rows = parseAmazonProduct(page, SOURCES[1]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].currentPrice, 99.9);
  assert.equal(rows[0].originalPrice, 99.9);
  assert.equal(parseAmazonProduct(page.replace('Em estoque', 'Indisponível'), SOURCES[1]).length, 0);
  assert.equal(parseAmazonProduct(page.replace('B07DVJC66X', 'B000E2CVDI'), SOURCES[1]).length, 0);
});
