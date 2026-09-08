import test from 'node:test';
import assert from 'node:assert/strict';
import { money, parseAmazonProduct, SOURCES } from '../src/scrapers/promo-collector.mjs';
import { validCoupon } from '../../lib/deals/coupon.ts';
import { createMarketplaceAdapter } from '../../lib/affiliates/adapters/index.ts';
import { CATEGORIES, limitOffersPerCategory } from '../../lib/offers.ts';
const page = reference => `<input id="ASIN" value="B07DVJC66X"><span id="productTitle">Loção hidratante Gold Bond 200 ml</span><img id="landingImage" src="https://m.media-amazon.com/images/I/test.jpg"><div id="availability">Em estoque</div><div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">R$ 258,72</span></span>${reference}</div>`;
test('unit reference 672.95/l never creates a false discount on 258.72 lotion', () => {
  for (const unit of ['l', 'kg', 'g', 'ml', 'un', 'unidade', 'm', 'm²']) {
    assert.equal(money(`R$ 672,95 / ${unit}`, 'BRL'), null);
    const [row] = parseAmazonProduct(page(`<span class="a-size-small a-color-secondary">(<span class="a-price a-text-price" data-a-strike="true"><span class="a-offscreen">R$ 672,95</span></span> / ${unit})</span>`), SOURCES[1]);
    assert.equal(row.originalPrice, 258.72);
  }
});
test('explicit strike may anchor a discount, missing or lower reference cannot', () => {
  for (const [reference, expected] of [[300, 300], [200, 258.72]]) {
    const [row] = parseAmazonProduct(page(`<span class="a-price a-text-price" data-a-strike="true"><span class="a-offscreen">R$ ${reference},00</span></span>`), SOURCES[1]);
    assert.equal(row.originalPrice, expected);
  }
});
test('coupon affects price only with verified unexpired evidence', () => {
  const now = Date.parse('2026-09-08T12:00:00Z');
  const coupon = { code: 'TESTE', price: 80, verifiedAt: '2026-09-08T11:00:00Z', validUntil: '2026-09-08T13:00:00Z' };
  assert.equal(validCoupon(coupon, 100, now)?.price, 80);
  assert.equal(validCoupon({ ...coupon, validUntil: '2026-09-08T10:00:00Z' }, 100, now), undefined);
  assert.equal(validCoupon({ ...coupon, price: 110 }, 100, now), undefined);
});
test('adapter validates currency and applies actual ML attribution', () => {
  const adapter = createMarketplaceAdapter('mercado_livre', payload => payload);
  const rows = adapter.parseOffer([{ currency: 'BRL', sourceUrl: 'https://produto.mercadolivre.com.br/MLB-12345-mouse' }, { currency: 'USD', sourceUrl: '' }]);
  assert.equal(rows.length, 1);
  assert.equal(new URL(rows[0].affiliateUrl).searchParams.get('matt_tool'), '29240022');
});
test('seven-category quota supports seven hundred distinct products', () => {
  const rows = CATEGORIES.flatMap(category => Array.from({ length: 105 }, (_, id) => ({ id: `${category}-${id}`, category, region: 'brasil', price: 10, discountPercent: 0 })));
  assert.equal(limitOffersPerCategory(rows).length, 700);
});
