import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Transpile the actual pure application modules without a Next server or any live tracking requests.
async function applicationModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { buildAffiliateUrl, selectRedirectOffer, validSlug, validOfferId } = await applicationModule('../lib/affiliate-links.ts');
const { limitOffersPerCategory } = await applicationModule('../lib/offers.ts');

const candidate = (id, overrides = {}) => ({ id, productId: 'same-product', network: 'amazon-br', price: 100,
  currency: 'BRL', shippingCost: null, availability: 'in_stock', sourceUrl: 'https://www.amazon.com.br/dp/B000E2CVDI',
  analyticsSource: 'legacy', ...overrides });

test('Amazon product links always use our regional tag and discard redirect/tracking arguments', () => {
  const url = new URL(buildAffiliateUrl({ rawUrl: 'https://www.amazon.com.br/name/dp/B000E2CVDI?tag=other-20&redirect=https://evil.test', network: 'amazon-br', preGeneratedAffiliateUrl: 'https://evil.test' }));
  assert.equal(url.searchParams.get('tag'), process.env.AMAZON_BR_TAG || 'ggm0e-20');
  assert.equal(url.pathname, '/dp/B000E2CVDI');
  assert.equal(url.searchParams.has('redirect'), false);
  const us = new URL(buildAffiliateUrl({ rawUrl: 'https://www.amazon.com/gp/product/B000E2CVDI', network: 'amazon-us' }));
  assert.equal(us.searchParams.get('tag'), process.env.AMAZON_US_TAG || 'ggm0e7-20');
});

test('rejects unsafe schemes, host lookalikes, credentials, ports and nonproduct Amazon routes', () => {
  for (const rawUrl of ['http://amazon.com.br/dp/B000E2CVDI', 'https://amazon.com.br.evil.test/dp/B000E2CVDI',
    'https://user:password@amazon.com.br/dp/B000E2CVDI', 'https://amazon.com.br:8080/dp/B000E2CVDI',
    'https://amazon.com.br/redirect?url=https://evil.test', 'https://amazon.com/dp/B000E2CVDI']) {
    assert.throws(() => buildAffiliateUrl({ rawUrl, network: 'amazon-br' }));
  }
});

test('Mercado Livre requires an allowlisted official pre-generated link and preserves its affiliate token', () => {
  const input = { rawUrl: 'https://www.mercadolivre.com.br/p/MLB123', network: 'mercado-livre' };
  assert.throws(() => buildAffiliateUrl(input), /pre-generated/);
  assert.throws(() => buildAffiliateUrl({ ...input, preGeneratedAffiliateUrl: 'https://evil.test/code' }));
  assert.equal(buildAffiliateUrl({ ...input, preGeneratedAffiliateUrl: 'https://mercadolivre.com/sec/official-token' }), 'https://mercadolivre.com/sec/official-token');
});

test('Brazil chooses the lowest known landed BRL cost; foreign countries use Amazon US only', () => {
  const rows = [candidate('amazon', { price: 80, shippingCost: 30 }),
    candidate('ml', { network: 'mercado-livre', price: 90, shippingCost: 5 }),
    candidate('us', { network: 'amazon-us', currency: 'USD', price: 20, shippingCost: 0 })];
  assert.equal(selectRedirectOffer(rows, 'BR').id, 'ml');
  assert.equal(selectRedirectOffer(rows, 'US').id, 'us');
  assert.equal(selectRedirectOffer(rows, 'AO').id, 'us');
});

test('unknown shipping is never treated as free and unknown geo requires an explicit store', () => {
  const rows = [candidate('unknown', { price: 20 }), candidate('known', { price: 80, shippingCost: 10 })];
  assert.equal(selectRedirectOffer(rows, 'BR').id, 'known');
  assert.equal(selectRedirectOffer(rows), null);
  assert.equal(selectRedirectOffer(rows, undefined, 'unknown').id, 'unknown');
});

test('explicit store overrides geo, and missing/expired choices never substitute another product or store', () => {
  const rows = [candidate('br'), candidate('expired', { expiresAt: '2001-01-01T00:00:00Z' }),
    candidate('out', { availability: 'out_of_stock' })];
  assert.equal(selectRedirectOffer(rows, 'US', 'br').id, 'br');
  assert.equal(selectRedirectOffer(rows, 'BR', 'unrelated-id'), null);
  assert.equal(selectRedirectOffer(rows, 'BR', 'expired'), null);
  assert.equal(selectRedirectOffer(rows, 'BR', 'out'), null);
  assert.equal(selectRedirectOffer(rows, 'US'), null);
});

test('slug and offer IDs reject query injection and unbounded input', () => {
  assert.equal(validSlug('amazon-br-b000e2cvdi'), true);
  assert.equal(validOfferId('7c8e6a51-0204-4da4-8e63-3e84e389093e'), true);
  for (const invalid of ['', '../admin', 'x&ativo=eq.false', 'x,y', 'x'.repeat(200)]) {
    assert.equal(validSlug(invalid), false);
    assert.equal(validOfferId(invalid), false);
  }
});

test('category cap reserves twenty products independently for each region', () => {
  const rows = ['brasil', 'global'].flatMap((region) => Array.from({ length: 25 }, (_, index) => ({
    id: `${region}-${index}`, region, category: 'Automotivo', price: 100, discountPercent: 50 - index,
  })));
  const selected = limitOffersPerCategory(rows, 20);
  assert.equal(selected.length, 40);
  assert.equal(selected.filter((offer) => offer.region === 'global').length, 20);
  assert.equal(selected.filter((offer) => offer.region === 'brasil').length, 20);
});
