import { readFile } from 'node:fs/promises';
import { supabase } from './ingestion.mjs';

const sourceFile = new URL('../../database/seed.catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(sourceFile, 'utf8'));

if (!Array.isArray(catalog) || catalog.length !== 60) {
  throw new Error('The launch catalog must contain exactly 60 products: 20 per public category.');
}

const slugify = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 72);

const products = catalog.map((item) => {
  const discount = Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100);
  return {
    id: `amazon-br-${item.asin}`,
    slug: `${slugify(item.title)}-${item.asin.toLowerCase()}`,
    plataforma: 'AMAZON_BR',
    titulo: item.title,
    categoria: item.category,
    subcategoria: item.subcategory,
    regiao: 'BRASIL',
    moeda: 'BRL',
    url_original: `https://www.amazon.com.br/dp/${item.asin}`,
    url_afiliado: `https://www.amazon.com.br/dp/${item.asin}?tag=${process.env.AMAZON_BR_TAG || 'ggm0e-20'}`,
    imagem_url: item.image,
    avaliacao: item.rating,
    origem_verificacao: 'AMAZON_ASSOCIADOS_SITESTRIPE',
    preco_atual: item.price,
    preco_medio_30d: item.oldPrice,
    desconto_real_percentual: discount,
    ativo: discount >= Number(process.env.MIN_REAL_DISCOUNT_PERCENT || 15),
    atualizado_em: new Date().toISOString(),
  };
});

const categoryCounts = products.reduce((counts, product) => {
  const category = product.subcategoria === 'PERFORMANCE_HIPERTROFIA'
    ? 'PERFORMANCE'
    : product.subcategoria === 'LONGEVIDADE_ESTETICA_SKINCARE'
      ? 'LONGEVIDADE'
      : 'AUTOMOTIVO';
  counts[category] = (counts[category] || 0) + 1;
  return counts;
}, {});
if (Object.values(categoryCounts).some((count) => count !== 20)) {
  throw new Error(`Invalid category distribution: ${JSON.stringify(categoryCounts)}`);
}

await supabase('produtos?on_conflict=id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(products),
});

console.log(JSON.stringify({ seeded: products.length, categoryCounts, tag: process.env.AMAZON_BR_TAG || 'ggm0e-20' }));
