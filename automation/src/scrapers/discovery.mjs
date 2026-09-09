import { load } from 'cheerio';
import { CATEGORIES } from '../../../lib/offers.ts';
import { ML_CATEGORIES } from './ml-public.mjs';

const queries = ['eletronicos', 'cozinha', 'beleza', 'automotivo', 'roupas', 'fitness', 'livros'];

/** Public discovery is bounded and stops on a challenge; only detail pages provide prices. */
export async function discoverSources(fetchPage, fetcher = fetch) {
  const sources = [], diagnostics = [];
  const pages = Math.min(10, Math.max(1, Number(process.env.COLLECTOR_DISCOVERY_PAGES) || 2));
  let blocked = false;
  for (const [index, query] of queries.entries()) {
    for (let page = 1; page <= pages; page++) {
      sources.push({ platform: 'mercado_livre', currency: 'BRL', categoryHint: CATEGORIES[index], url: `https://www.mercadolivre.com.br/ofertas?category=${ML_CATEGORIES[index]}&page=${page}` });
      if (blocked) continue;
      try {
        const source = { platform: 'amazon_br', currency: 'BRL', url: `https://www.amazon.com.br/s?k=${encodeURIComponent(query)}&page=${page}` };
        const $ = load(await fetchPage(source, fetcher));
        const asins = [...new Set($('[data-component-type="s-search-result"][data-asin]').toArray().map(node => $(node).attr('data-asin')).filter(asin => /^[A-Z0-9]{10}$/.test(asin)))];
        sources.push(...asins.map(asin => ({ platform: 'amazon_br', currency: 'BRL', categoryHint: CATEGORIES[index], url: `https://www.amazon.com.br/dp/${asin}` })));
        diagnostics.push({ category: CATEGORIES[index], page, discovered: asins.length });
      } catch (error) {
        blocked = /http_(401|403|429|503)|access_challenge/.test(error.message);
        diagnostics.push({ category: CATEGORIES[index], page, discovered: 0, status: blocked ? 'access_blocked' : 'unavailable' });
      }
    }
  }
  console.table(diagnostics);
  // Round-robin categories so a request budget cannot starve the last niches.
  const buckets = CATEGORIES.map(category => sources.filter(source => source.categoryHint === category));
  const balanced = [];
  for (let index = 0; index < Math.max(...buckets.map(bucket => bucket.length)); index++) {
    for (const bucket of buckets) if (bucket[index]) balanced.push(bucket[index]);
  }
  return balanced;
}
