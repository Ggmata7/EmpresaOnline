import test from 'node:test';
import assert from 'node:assert/strict';
import { enableCaptureBatch, captureOfferInTransaction } from '../../lib/deals/dedup.ts';
test('locked batch shares a national product across stores, never across same-store IDs', async () => {
  let sequence = 0, reads = 0;
  const tx = {
    execute: async () => [],
    select: () => ({ from: async () => { reads++; return []; } }),
    insert: () => ({ values: value => ({ returning: async () => [{ id: `row-${++sequence}`, ...value }] }) }),
    update: () => { throw new Error('unnecessary product update'); },
  };
  const state = await enableCaptureBatch(tx);
  const base = { title: 'Creatina Marca X 300g', category: 'Esporte e Fitness', currentPrice: 80,
    originalPrice: 100, currency: 'BRL', inStock: true, checkedAt: new Date() };
  const amazon = await captureOfferInTransaction(tx, { ...base, platform: 'amazon_br', externalId: 'B000E2CVDI', sourceUrl: 'https://www.amazon.com.br/dp/B000E2CVDI' });
  const ml = await captureOfferInTransaction(tx, { ...base, platform: 'mercado_livre', externalId: 'MLB12345', sourceUrl: 'https://www.mercadolivre.com.br/p/MLB12345' });
  assert.equal(amazon.productId, ml.productId);
  const variant = await captureOfferInTransaction(tx, { ...base, platform: 'amazon_br', externalId: 'B000NKCIKM', sourceUrl: 'https://www.amazon.com.br/dp/B000NKCIKM' });
  assert.notEqual(variant.productId, amazon.productId);
  assert.equal(reads, 2);
  assert.equal(state.products.length, 2);
  assert.equal(state.offers.length, 3);
});
