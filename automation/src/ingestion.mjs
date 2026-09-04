import { buildAffiliateUrl, assertTagged } from './affiliate-links.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url, { attempts = 4, timeoutMs = 15_000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'AffiliateRadar/1.0 (+contact configured by operator)', accept: 'text/html,application/json' },
        redirect: 'follow', signal: controller.signal,
      });
      if (response.ok) return response;
      if (![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`HTTP ${response.status}`);
      const retryAfter = Number(response.headers.get('retry-after')) * 1000;
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : (2 ** attempt) * 1000 + Math.random() * 500);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep((2 ** attempt) * 1000 + Math.random() * 500);
    } finally { clearTimeout(timer); }
  }
  throw lastError || new Error('Request failed.');
}

function extractJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const value = JSON.parse(match[1].trim());
      const entries = Array.isArray(value) ? value : value['@graph'] || [value];
      const product = entries.find((entry) => entry?.['@type'] === 'Product');
      if (product) return product;
    } catch { /* Invalid embedded JSON-LD: try the next block. */ }
  }
  throw new Error('No valid Product JSON-LD found. Prefer the retailer affiliate API for this source.');
}

export function parseProductHtml(html, source) {
  const product = extractJsonLd(html);
  const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const price = Number(offers?.price ?? offers?.lowPrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid product price.');
  return {
    external_id: source.externalId,
    plataforma: source.platform,
    titulo: String(product.name || '').replace(/\s+/g, ' ').trim(),
    imagem_url: Array.isArray(product.image) ? product.image[0] : product.image,
    preco: price,
    moeda: offers?.priceCurrency || (source.region === 'BRASIL' ? 'BRL' : 'USD'),
    disponivel: !String(offers?.availability || '').toLowerCase().includes('outofstock'),
  };
}

export function calculateRealDiscount(currentPrice, thirtyDayPrices, minimumPercent = 15) {
  const valid = thirtyDayPrices.map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (valid.length < 3) return { approved: false, reason: 'insufficient-history', discountPercent: 0, baseline: null };
  const trim = Math.floor(valid.length * 0.1);
  const stable = valid.slice(trim, valid.length - trim || undefined);
  const baseline = stable.reduce((sum, value) => sum + value, 0) / stable.length;
  const discountPercent = Number((((baseline - currentPrice) / baseline) * 100).toFixed(2));
  return { approved: discountPercent >= minimumPercent, reason: discountPercent >= minimumPercent ? 'real-discount' : 'below-threshold', discountPercent, baseline: Number(baseline.toFixed(2)) };
}

export async function supabase(path, options = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.headers.get('content-type')?.includes('json') ? response.json() : null;
}

export async function ingestSource(source) {
  const response = await fetchWithRetry(source.url);
  const parsed = parseProductHtml(await response.text(), source);
  const affiliateUrl = assertTagged(buildAffiliateUrl({ rawUrl: source.url, platform: source.platform, affiliateUrl: source.affiliateUrl }), source.platform);

  const history = await supabase(`historico_precos?select=preco&produto_id=eq.${encodeURIComponent(source.productId)}&coletado_em=gte.${encodeURIComponent(new Date(Date.now() - 30 * 86400000).toISOString())}`);
  const evaluation = calculateRealDiscount(parsed.preco, history.map((row) => row.preco), Number(process.env.MIN_REAL_DISCOUNT_PERCENT || 15));
  if (!evaluation.approved) return { source: source.url, published: false, ...evaluation };

  await supabase('produtos?on_conflict=slug', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: source.productId, slug: source.slug, plataforma: source.platform, titulo: parsed.titulo,
      categoria: source.category, subcategoria: source.subcategory, regiao: source.region, moeda: parsed.moeda,
      url_original: source.url, url_afiliado: affiliateUrl, imagem_url: parsed.imagem_url,
      preco_atual: parsed.preco, preco_medio_30d: evaluation.baseline, desconto_real_percentual: evaluation.discountPercent,
      oferta_valida_ate: source.expiresAt || null, ativo: true, atualizado_em: new Date().toISOString(),
    }),
  });
  await supabase('historico_precos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ produto_id: source.productId, preco: parsed.preco, disponivel: parsed.disponivel, fonte: source.platform }) });
  return { source: source.url, published: true, ...evaluation };
}

export async function runIngestion(sources) {
  const concurrency = Math.max(1, Number(process.env.MAX_CONCURRENCY || 3));
  const results = [];
  for (let offset = 0; offset < sources.length; offset += concurrency) {
    const batch = sources.slice(offset, offset + concurrency);
    results.push(...await Promise.allSettled(batch.map(ingestSource)));
    await sleep(500 + Math.random() * 500);
  }
  return results;
}
