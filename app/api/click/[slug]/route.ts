import { NextResponse } from 'next/server';
import { loadOfferBySlug } from '@/lib/catalog';
import { buildAffiliateUrl } from '@/lib/affiliate-links';

async function recordClick(offerId: string, request: Request) {
  const endpoint = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!endpoint || !serviceKey) return;

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const salt = process.env.CLICK_HASH_SALT || serviceKey.slice(0, 16);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${forwardedFor}`));
  const visitorHash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  await fetch(`${endpoint.replace(/\/$/, '')}/rest/v1/cliques`, {
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
      referer: request.headers.get('referer'),
    }),
  });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const offer = await loadOfferBySlug(slug);
  if (!offer) return NextResponse.json({ error: 'Oferta não encontrada ou expirada.' }, { status: 404 });

  let destination: string;
  try {
    destination = buildAffiliateUrl({
      rawUrl: offer.sourceUrl,
      network: offer.network,
      preGeneratedAffiliateUrl: offer.affiliateUrl,
    });
  } catch {
    return NextResponse.json(
      { error: 'O link afiliado desta oferta precisa ser renovado.' },
      { status: 503 },
    );
  }

  await recordClick(offer.id, request).catch(() => undefined);
  return NextResponse.redirect(destination, 302);
}
