import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAffiliateUrl, sanitizeUrl } from '../src/affiliate-links.mjs';
import { calculateRealDiscount, parseProductHtml } from '../src/ingestion.mjs';
import { formatOfferMessage } from '../src/whatsapp.mjs';

test('sanitizes third-party tracking and injects the configured Amazon BR tag', () => {
  process.env.AMAZON_BR_TAG = 'ggm0e-20';
  const clean = sanitizeUrl('https://www.amazon.com.br/dp/ABC?utm_source=x&tag=someone-20&q=1');
  assert.equal(clean.searchParams.get('utm_source'), null);
  assert.equal(clean.searchParams.get('tag'), null);
  const tagged = new URL(buildAffiliateUrl({ rawUrl: clean, platform: 'AMAZON_BR' }));
  assert.equal(tagged.searchParams.get('tag'), 'ggm0e-20');
  assert.equal(tagged.searchParams.get('q'), '1');
});

test('fails closed for a network that requires an official deep link', () => {
  assert.throws(() => buildAffiliateUrl({ rawUrl: 'https://www.mercadolivre.com.br/p/MLB1', platform: 'MERCADO_LIVRE' }), /official pre-generated/);
});

test('approves only a discount above the 30-day baseline threshold', () => {
  const result = calculateRealDiscount(80, [100, 101, 99, 100, 102], 15);
  assert.equal(result.approved, true);
  assert.ok(result.discountPercent >= 19 && result.discountPercent <= 21);
  assert.equal(calculateRealDiscount(95, [100, 101, 99], 15).approved, false);
  assert.equal(calculateRealDiscount(80, [100, 101], 15).reason, 'insufficient-history');
});

test('parses a standards-based Product JSON-LD payload', () => {
  const html = `<script type="application/ld+json">{"@type":"Product","name":"  Whey   Protein  ","image":["https://img.test/a.jpg"],"offers":{"price":"79.90","priceCurrency":"BRL","availability":"https://schema.org/InStock"}}</script>`;
  const result = parseProductHtml(html, { externalId: 'SKU1', platform: 'AMAZON_BR', region: 'BRASIL' });
  assert.equal(result.titulo, 'Whey Protein');
  assert.equal(result.preco, 79.9);
  assert.equal(result.disponivel, true);
});

test('formats the WhatsApp message with disclosure and affiliate URL', () => {
  const text = formatOfferMessage({ titulo: 'Kit de teste', moeda: 'BRL', desconto_real_percentual: 25, preco_medio_30d: 200, preco_atual: 150, cupom: 'TESTE10', short_url: 'https://example.test/o/1' });
  assert.match(text, /25% OFF/);
  assert.match(text, /TESTE10/);
  assert.match(text, /Publicidade/);
});
