import { after, NextResponse } from 'next/server';
import { CatalogUnavailableError, loadRedirectCandidates } from '@/lib/catalog';
import { buildAffiliateUrl, selectRedirectOffer, validOfferId, validSlug, type RedirectCandidate } from '@/lib/affiliate-links';

function trustedCountry(request: Request) {
  // Vercel replaces this header at its edge. Other client-supplied geo/IP headers are not trusted.
  if (process.env.VERCEL !== '1') return undefined;
  const country = request.headers.get('x-vercel-ip-country')?.toUpperCase();
  return country && /^[A-Z]{2}$/.test(country) ? country : undefined;
}

async function recordClick(offer: RedirectCandidate, request: Request, country?: string) {
  const endpoint = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endpoint || !key) return;
  const ip = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : undefined;
  const salt = process.env.CLICK_HASH_SALT;
  let visitorHash: string | null = null;
  if (ip && salt) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
    visitorHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  const normalized = offer.analyticsSource === 'normalized';
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/rest/v1/${normalized ? 'click_analytics' : 'cliques'}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(normalized ? {
      offer_id: offer.id, user_country: country || null, ip_hash: visitorHash,
      user_agent: request.headers.get('user-agent')?.slice(0, 512), channel: 'catalogo-web',
    } : {
      produto_id: offer.id, canal: 'catalogo-web', visitor_hash: visitorHash,
      user_agent: request.headers.get('user-agent')?.slice(0, 512),
      referer: null,
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) console.error('Click analytics unavailable:', response.status);
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function handleOfferRedirect(request: Request, slug: string, legacy = false) {
  const selectedId = new URL(request.url).searchParams.get('offer');
  if (!validSlug(slug) || (selectedId !== null && !validOfferId(selectedId))) {
    return error('Identificador de oferta inválido.', 400);
  }
  let candidates: RedirectCandidate[];
  try { candidates = await loadRedirectCandidates(slug); }
  catch (cause) {
    console.error('Redirect catalog unavailable:', cause instanceof CatalogUnavailableError ? cause.message : 'unexpected response');
    return error('O catálogo está temporariamente indisponível. Tente novamente.', 503);
  }
  if (!candidates.length) return error('Oferta não encontrada ou expirada.', 404);
  const country = trustedCountry(request);
  // Existing /api/click links keep their advertised retailer; new cards send an explicit offer ID.
  const explicitId = selectedId || (legacy ? candidates[0].id : undefined);
  const offer = selectRedirectOffer(candidates, country, explicitId);
  if (!offer) return error(!country && !explicitId
    ? 'Selecione uma loja no catálogo para abrir esta oferta.'
    : 'Não há oferta deste produto disponível na loja ou região selecionada.', !country && !explicitId ? 400 : 404);
  let destination: string;
  try {
    destination = buildAffiliateUrl({ rawUrl: offer.sourceUrl, network: offer.network, preGeneratedAffiliateUrl: offer.affiliateUrl });
  } catch { return error('O link desta loja precisa ser atualizado. Selecione outra oferta no catálogo.', 503); }
  after(async () => {
    try { await recordClick(offer, request, country); }
    catch { console.error('Click analytics could not be recorded.'); }
  });
  const response = NextResponse.redirect(destination, 307);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}
