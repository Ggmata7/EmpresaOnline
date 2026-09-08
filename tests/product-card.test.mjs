import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const dataUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
async function compile(path, replacements = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return dataUrl(outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, name) => `from ${JSON.stringify(replacements[name] || import.meta.resolve(name))}`));
}
const comparison = await compile('../lib/product-comparison.ts');
const mockImage = dataUrl(`import {createElement} from ${JSON.stringify(import.meta.resolve('react'))}; export default function Image({src,alt}) {return createElement('img',{src,alt});}`);
const { ProductCard } = await import(await compile('../components/ProductCard.tsx', { '@/lib/product-comparison': comparison, 'next/image': mockImage }));
const offer = { id: 'primary', slug: 'product', title: 'Produto de teste', region: 'brasil', category: 'Automotivo',
  network: 'mercado-livre', retailer: 'Mercado Livre', price: 85, oldPrice: 85, currency: 'BRL' };
test('national card renders winner and independent tracked competitor without unverified benefits', () => {
  const html = renderToStaticMarkup(createElement(ProductCard, { offer: { ...offer, alternatives: [{ id: 'secondary', network: 'amazon-br', currency: 'BRL', price: 89.9 }] } }));
  assert.match(html, /Melhor Preço/);
  assert.match(html, /Também na Amazon/);
  assert.match(html, /offer=primary/);
  assert.match(html, /offer=secondary/);
  assert.doesNotMatch(html, /Prime|Meli\+/);
});
test('zero discount hides percent and strikethrough; missing image has accessible fallback', () => {
  const html = renderToStaticMarkup(createElement(ProductCard, { offer }));
  assert.doesNotMatch(html, /% OFF|<s>|Melhor Preço/);
  assert.match(html, /Preço vigente na loja/);
  assert.match(html, /Imagem indisponível/);
});
test('international card uses USD only and rejects mislabeled currencies', () => {
  const us = { ...offer, region: 'global', isInternational: true, network: 'amazon-us', currency: 'USD', price: 15.99, oldPrice: 15.99 };
  const html = renderToStaticMarkup(createElement(ProductCard, { offer: us }));
  assert.match(html, /Importado \(EUA\)/);
  assert.match(html, /\$15.99 USD/);
  assert.doesNotMatch(html, /R\$/);
  assert.equal(renderToStaticMarkup(createElement(ProductCard, { offer: { ...us, currency: 'BRL' } })), '');
});
