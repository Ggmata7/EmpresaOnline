import { NextResponse } from 'next/server';
import { offers } from '@/lib/offers';
import { buildAffiliateUrl } from '@/lib/affiliate-links';

async function recordClick(offerId: string, request: Request) {
  const endpoint = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endpoint || !serviceKey) return;

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(forwardedFor));
  const visitorHash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  await fetch(`${endpoint}/rest/v1/cliques`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      produto_id: offerId,
      canal: 'catalogo-web',
      visitor_hash: visitorHash || null,
      user_agent: request.headers.get('user-agent'),
    }),
  });
}

function resolveFallbackUrl(offer: (typeof offers)[number]): string | null {
  // 1. Se já existir um link de afiliado oficial pronto, use-o
  if (offer.affiliateUrl && offer.affiliateUrl.trim().length > 0) {
    return offer.affiliateUrl;
  }

  // 2. Se for Amazon, constrói e injeta a tag correspondente diretamente
  if (offer.sourceUrl) {
    try {
      const url = new URL(offer.sourceUrl);
      if (url.hostname.includes('amazon.com.br')) {
        url.searchParams.set('tag', process.env.AMAZON_BR_TAG || 'ggm0e-20');
        return url.toString();
      }
      if (url.hostname.includes('amazon.com')) {
        url.searchParams.set('tag', process.env.AMAZON_US_TAG || 'ggm0e7-20');
        return url.toString();
      }
      // Fallback para provedores futuros que aceitam parâmetro na query (ex: iHerb)
      if (url.hostname.includes('iherb.com') && process.env.IHERB_REWARD_CODE) {
        url.searchParams.set('rcode', process.env.IHERB_REWARD_CODE);
        return url.toString();
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const offer = offers.find((item) => item.slug === slug);

  if (!offer) {
    return NextResponse.json({ error: 'Oferta não encontrada.' }, { status: 404 });
  }

  let destination: string | null = null;

  // Tenta resolver via builder original
  try {
    destination = buildAffiliateUrl({
      rawUrl: offer.sourceUrl,
      network: offer.network,
      preGeneratedAffiliateUrl: offer.affiliateUrl,
    });
  } catch {
    // Se o builder padrão falhar (ex: trava de Mercado Livre), aplica o fallback
    destination = resolveFallbackUrl(offer);
  }

  // Se mesmo após o fallback não houver link monetizado válido
  if (!destination) {
    return NextResponse.json(
      { error: 'Link ainda não publicado. Gere o deep link oficial dessa oferta no painel da rede de afiliados.' },
      { status: 503 },
    );
  }

  // Registra a métrica no Supabase de forma assíncrona
  await recordClick(offer.id, request).catch(() => undefined);

  return NextResponse.redirect(destination, 302);
}