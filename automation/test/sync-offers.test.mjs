import test from 'node:test';
import assert from 'node:assert/strict';
import { mapConcurrent, parseAmazonItemResponse, parseMercadoLivreItem } from '../../lib/sync-offers/core.mjs';

test('partner queue never exceeds five requests and isolates one failed item', async () => {
  let running = 0;
  let maximum = 0;
  const results = await mapConcurrent(Array.from({ length: 17 }, (_, index) => index), async (item) => {
    running++;
    maximum = Math.max(maximum, running);
    await new Promise((resolve) => setTimeout(resolve, 2));
    running--;
    if (item === 7) throw new Error('partner_http_429');
    return item * 2;
  }, 100);
  assert.equal(maximum, 5);
  assert.equal(results[7].status, 'rejected');
  assert.equal(results[16].value, 32);
});

test('budget expiration defers candidates without pretending they were checked', async () => {
  let calls = 0;
  const results = await mapConcurrent([1, 2], () => calls++, 5, Date.now() - 1);
  assert.equal(calls, 0);
  assert.ok(results.every((row) => row.status === 'skipped'));
});

test('Mercado Livre paused listing is unavailable; invalid identity and price fail closed', () => {
  const base = { id: 'MLB123', status: 'paused', currency_id: 'BRL', price: 79.9, original_price: 99.9 };
  assert.equal(parseMercadoLivreItem(base, 'MLB123').inStock, false);
  assert.throws(() => parseMercadoLivreItem(base, 'MLB999'), /identity/);
  assert.throws(() => parseMercadoLivreItem({ ...base, status: 'active', price: null }, 'MLB123'), /price/);
  assert.throws(() => parseMercadoLivreItem({ ...base, status: 'under_review' }, 'MLB123'), /stock/);
});

const amazonListing = {
  condition: { value: 'New' }, availability: { type: 'IN_STOCK' }, isBuyBoxWinner: true,
  price: { money: { amount: 59.49, currency: 'USD' }, savingBasis: { savingBasisType: 'LIST_PRICE', money: { amount: 69.99, currency: 'USD' } } },
};
const amazon = (listing) => ({ itemsResult: { items: [{ asin: 'B000000001', offersV2: { listings: [listing] } }] } });

test('Creators API reads exact ASIN, currency and documented list baseline only', () => {
  const observation = parseAmazonItemResponse(amazon(amazonListing), 'B000000001', 'USD');
  assert.equal(observation.currentPrice, 59.49);
  assert.equal(observation.originalPrice, 69.99);
  assert.equal(observation.referencePriceKind, 'list');
  assert.equal(observation.isDealOfTheDay, false);
  assert.throws(() => parseAmazonItemResponse(amazon(amazonListing), 'B999999999', 'USD'), /accessible/);
  assert.throws(() => parseAmazonItemResponse(amazon(amazonListing), 'B000000001', 'BRL'), /currency/);
});

test('Creators API never publishes Prime-only, subscription, MAP or unknown availability prices', () => {
  for (const override of [{ dealDetails: { accessType: 'PRIME_EXCLUSIVE' } }, { type: 'SUBSCRIBE_AND_SAVE' }, { violatesMAP: true }, { availability: { type: 'UNKNOWN' } }]) {
    assert.throws(() => parseAmazonItemResponse(amazon({ ...amazonListing, ...override }), 'B000000001', 'USD'));
  }
  assert.throws(() => parseAmazonItemResponse({ itemsResult: { items: [{ asin: 'B000000001' }] } }, 'B000000001', 'USD'), /missing_offer_data/);
});
