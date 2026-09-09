import test from 'node:test';
import assert from 'node:assert/strict';
import { mlProductLinks, ML_HEADERS, collectMlPublic } from '../src/scrapers/ml-public.mjs';
import { parsePromotions, money } from '../src/scrapers/promo-collector.mjs';
import { tagAffiliateUrl } from '../../lib/affiliates/tagger.ts';
const source = { platform: 'mercado_livre', currency: 'BRL', url: 'https://www.mercadolivre.com.br/ofertas' };
const card = `<div class="poly-card"><a class="poly-component__title" href="https://www.mercadolivre.com.br/mouse/p/MLB12345">Mouse Logitech M280</a><img src="https://http2.mlstatic.com/test.webp"><s class="andes-money-amount"><span class="andes-money-amount__fraction">120</span></s><div class="poly-price__current"><span class="andes-money-amount"><span class="andes-money-amount__fraction">89</span><span class="andes-money-amount__cents">90</span></span></div><div class="poly-component__shipping-v2">Chegará amanhã</div></div>`;
test('ML public card needs delivery/stock evidence and preserves actual price', () => {
  const [row] = parsePromotions(card, source);
  assert.equal(row.currentPrice, 89.9);
  assert.equal(row.originalPrice, 120);
  assert.equal(parsePromotions(card.replace('Chegará amanhã', ''), source).length, 0);
  const url = new URL(tagAffiliateUrl(row.sourceUrl, row.platform));
  assert.equal(url.searchParams.get('matt_tool'), '29240022');
  assert.equal(url.searchParams.get('matt_word'), 'barrosgabriel20220204212655');
  assert.equal(url.searchParams.get('forceInApp'), 'true');
});
test('discovery accepts canonical catalog links but not external or login URLs', () => {
  assert.deepEqual(mlProductLinks('<loc>https://www.mercadolivre.com.br/p/MLB12345</loc><loc>https://evil.test/p/MLB12345</loc><a href="/gz/account-verification">Login</a>', source.url), ['https://www.mercadolivre.com.br/p/MLB12345']);
});
test('ML unit references cannot become discount anchors', () => {
  const html = card.replace('</s>', ' / kg</s>');
  const [row] = parsePromotions(html, source);
  assert.equal(row.originalPrice, row.currentPrice);
});
test('403 uses one public sitemap fallback without evading access checks', async () => {
  let calls = 0;
  await assert.rejects(collectMlPublic(source, { parsePromotions, money,
    fetchPage: async () => { throw new Error('http_403'); },
    fetcher: async (_, options) => { calls++; assert.equal(options.headers, ML_HEADERS); return new Response('', { status: 403 }); },
  }), /http_403/);
  assert.equal(calls, 1);
});
test('rate limiting is not retried using a sitemap', async () => {
  await assert.rejects(collectMlPublic(source, { parsePromotions, money,
    fetchPage: async () => { throw new Error('http_429'); },
    fetcher: async () => { assert.fail('no fallback on rate limits'); },
  }), /http_429/);
});
