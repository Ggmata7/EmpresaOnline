import postgres from 'postgres';
import { load } from 'cheerio';
import { CATEGORIES } from '../lib/offers.ts';
import { ML_CATEGORIES } from '../automation/src/scrapers/ml-public.mjs';
import { fetchPage, runPublicCollector } from '../automation/src/scrapers/promo-collector.mjs';

// Discovery terms, NOT a fabricated ranking or seeded prices. Identities, images,
// prices and availability come exclusively from the current public pages.
export const NICHES = [
  ['smartphone samsung', 'smartwatch', 'fone bluetooth', 'ssd', 'mouse logitech', 'teclado', 'cabo usb', 'monitor', 'tablet', 'caixa som'],
  ['airfryer', 'liquidificador', 'aspirador robo', 'organizador cozinha', 'ventilador', 'jogo panelas', 'cafeteira', 'travesseiro', 'jogo toalhas', 'ferro passar'],
  ['serum retinol', 'serum vitamina c', 'protetor solar', 'perfume', 'secador cabelo', 'kit shampoo', 'hidratante', 'maquiagem', 'sabonete facial', 'mascara capilar'],
  ['aromatizante carro', 'lampada automotiva', 'compressor portatil', 'suporte celular veicular', 'kit ferramentas automotivo', 'cera automotiva', 'shampoo automotivo', 'pneu', 'palheta limpador', 'filtro oleo'],
  ['kit meias', 'camiseta basica', 'tenis corrida', 'mochila', 'relogio casual', 'calca jeans', 'bolsa feminina', 'kit cuecas', 'chinelo', 'jaqueta'],
  ['creatina 300g', 'creatina 500g', 'whey isolado', 'whey concentrado', 'coqueteleira', 'elastico extensor', 'faixa treino', 'halter', 'tapete yoga', 'garrafa termica'],
  ['livros negocios', 'livros financas', 'livros autoajuda', 'livros ficcao', 'livros tecnologia', 'livros programacao', 'livros romance', 'livros historia', 'livros literatura', 'livros desenvolvimento pessoal'],
];

const client = postgres(process.env.DATABASE_URL || '', { max: 1, prepare: false,
  ssl: { rejectUnauthorized: false }, connect_timeout: 10 });
const deadline = Date.now() + Math.min(120, Math.max(1, Number(process.env.SCALE_MINUTES) || 25)) * 60_000;
const seen = new Set<string>();
const blocked = new Set<string>();
try {
  if (!process.env.DATABASE_URL) throw new Error('database_url_missing');
  await runPublicCollector({ sources: [{ platform: 'mercado_livre', currency: 'BRL', url: 'https://www.mercadolivre.com.br/ofertas' }] });
  for (let round = 0; round < 10 && Date.now() < deadline; round++) {
    for (const [index, category] of CATEGORIES.entries()) {
      if (Date.now() >= deadline) break;
      const [count] = await client`select count(distinct p.normalized_title)::int as total from products p join offers o on o.product_id=p.id
        where p.category=${category} and not p.is_international and o.is_active and o.in_stock and (o.expires_at is null or o.expires_at>now())`;
      if (count.total >= 100) continue;
      const query = NICHES[index][round];
      console.info(`[scale] ${category}: ${count.total}/100; busca: ${query}`);
      const sources = [];
      if (!blocked.has('mercado_livre')) sources.push({ platform: 'mercado_livre', currency: 'BRL', categoryHint: category,
        url: `https://www.mercadolivre.com.br/ofertas?category=${ML_CATEGORIES[index]}&page=${round + 1}` });
      // First fill from lightweight public cards; use canonical Amazon details to
      // supplement each category after the first three ML pages or when ML blocks.
      if (!blocked.has('amazon_br') && (round >= 3 || blocked.has('mercado_livre'))) {
        try {
          const source = { platform: 'amazon_br', currency: 'BRL', url: `https://www.amazon.com.br/s?k=${encodeURIComponent(query)}` };
          const $ = load(await fetchPage(source));
          for (const node of $('[data-component-type="s-search-result"][data-asin]').toArray()) {
            const asin = $(node).attr('data-asin') || '';
            if (!/^[A-Z0-9]{10}$/.test(asin) || seen.has(asin)) continue;
            seen.add(asin);
            sources.push({ platform: 'amazon_br', currency: 'BRL', categoryHint: category, url: `https://www.amazon.com.br/dp/${asin}` });
          }
        } catch (error) {
          if (/http_(401|403|429|503)|access_challenge/.test((error as Error).message)) blocked.add('amazon_br');
          console.warn('[scale] descoberta Amazon indisponível');
        }
      }
      if (sources.length) {
        const result = await runPublicCollector({ sources });
        for (const diagnostic of result.diagnostics) {
          if (/http_(401|403|429|503)|access_challenge/.test(diagnostic.reason || '')) blocked.add(diagnostic.platform);
        }
      }
      if (blocked.size === 2) break;
    }
    if (blocked.size === 2) break;
  }
  const counts = await client`select p.category, count(distinct p.normalized_title)::int as total from products p join offers o on o.product_id=p.id
    where not p.is_international and o.is_active and o.in_stock and (o.expires_at is null or o.expires_at>now()) group by p.category`;
  const report = CATEGORIES.map(category => ({ category, verifiedDistinctTitles: counts.find(row => row.category === category)?.total || 0 }));
  console.table(report);
  console.table(await client`select platform,count(*)::int as offers from offers group by platform`);
  if (report.some(row => row.verifiedDistinctTitles < 100)) { console.warn('META 700 NÃO ATINGIDA. Não foram criados preços, estoque ou produtos fictícios.'); process.exitCode = 1; }
} catch (error) { console.error('scale_failed', (error as {code?: string}).code || 'network_or_validation'); process.exitCode = 1; }
finally { await client.end({ timeout: 5 }); }
