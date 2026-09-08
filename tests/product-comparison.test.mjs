import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../lib/product-comparison.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { lowestPriceFirst, competitorFor, trackingHref } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
test('comparison ranks item price, irrespective of shipping cost', () => {
  const rows = [{ id: 'amazon', price: 80, shippingCost: 50 }, { id: 'ml', price: 90, shippingCost: 0 }];
  assert.equal(rows.sort(lowestPriceFirst)[0].id, 'amazon');
});
test('secondary link chooses the other domestic store, never USD or the same store', () => {
  const offer = { network: 'amazon-br', region: 'brasil', currency: 'BRL', alternatives: [
    { id: 'same', network: 'amazon-br', currency: 'BRL', price: 80 },
    { id: 'us', network: 'amazon-us', currency: 'USD', price: 10 },
    { id: 'ml', network: 'mercado-livre', currency: 'BRL', price: 90 }] };
  assert.equal(competitorFor(offer).id, 'ml');
  assert.equal(competitorFor({ ...offer, isInternational: true }), undefined);
});
test('tracking preserves the chosen offer identity and escapes parameters', () => {
  assert.equal(trackingHref('produto', 'chosen-id'), '/api/c/produto?offer=chosen-id');
  assert.equal(trackingHref('a/b', 'x&y'), '/api/c/a%2Fb?offer=x%26y');
});
