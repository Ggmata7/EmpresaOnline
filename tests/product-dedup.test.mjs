import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function moduleFrom(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { normalizeTitle, titlesMatch } = await moduleFrom('../lib/deals/match.ts');
const { tagAffiliateUrl } = await moduleFrom('../lib/affiliates/tagger.ts');

test('normalization removes accents, punctuation and repeated spaces', () => {
  assert.equal(normalizeTitle('  Fône Bluetooth – Ação!  '), 'fone bluetooth acao');
  assert.equal(titlesMatch('Logitech Mouse M280 Preto', 'Mouse Logitech M280 preto'), true);
  assert.equal(titlesMatch('', ''), false);
});
test('matching preserves capacity, model, color, voltage and quantity', () => {
  for (const [a, b] of [['iPhone 15 128GB', 'iPhone 15 256GB'], ['Mouse M280', 'Mouse M185'],
    ['Mouse preto', 'Mouse branco'], ['Compressor 110V', 'Compressor 220V'], ['Kit 2 pneus', 'Kit 4 pneus']]) {
    assert.equal(titlesMatch(a, b), false);
  }
});
test('curated creatine identity matches only the same formula, brand and package size', () => {
  const title = 'Soldiers Nutrition Creatina Monohidratada 1kg';
  assert.equal(titlesMatch(title, 'Creatina 1kg Suplemento Monohidratada em pó 100% Pura - Soldiers Nutrition'), true);
  assert.equal(titlesMatch(title, title.replace('1kg', '500g')), false);
  assert.equal(titlesMatch(title, 'Kit 2 ' + title), false);
  assert.equal(titlesMatch(title, title + ' com beta alanina'), false);
});

test('Amazon tags replace duplicate tags and discard redirect parameters', () => {
  const br = new URL(tagAffiliateUrl('https://www.amazon.com.br/dp/B000E2CVDI?tag=other&tag=bad&redirect=evil', 'amazon_br'));
  assert.deepEqual(br.searchParams.getAll('tag'), ['ggm0e-20']);
  assert.equal(br.searchParams.has('redirect'), false);
  assert.equal(new URL(tagAffiliateUrl('https://amazon.com/gp/product/B000E2CVDI', 'amazon_us')).searchParams.get('tag'), 'ggm0e7-20');
});
test('ML applies exact attribution and preserves product variation; tagging is idempotent', () => {
  const tagged = tagAffiliateUrl('https://produto.mercadolivre.com.br/MLB-12345-mouse?matt_tool=other&matt_word=old&variation=7', 'mercado_livre');
  const url = new URL(tagged);
  assert.equal(url.searchParams.get('matt_tool'), '29240022');
  assert.equal(url.searchParams.get('matt_word'), 'barrosgabriel20220204212655');
  assert.equal(url.searchParams.get('forceInApp'), 'true');
  assert.equal(url.searchParams.get('variation'), '7');
  assert.equal(tagAffiliateUrl(tagged, 'mercado_livre'), tagged);
});
test('rejects non-product URLs, region mismatch, lookalikes, credentials and shortlinks', () => {
  for (const url of ['https://amazon.com.br.evil.test/dp/B000E2CVDI', 'http://amazon.com.br/dp/B000E2CVDI',
    'https://user:pass@amazon.com.br/dp/B000E2CVDI', 'https://amazon.com/dp/B000E2CVDI', 'https://amazon.com.br/redirect']) {
    assert.throws(() => tagAffiliateUrl(url, 'amazon_br'));
  }
  assert.throws(() => tagAffiliateUrl('https://meli.la/unknown', 'mercado_livre'));
  assert.throws(() => tagAffiliateUrl('https://www.mercadolivre.com.br/redirect?url=evil', 'mercado_livre'));
});
