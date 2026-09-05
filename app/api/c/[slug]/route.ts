import { handleOfferRedirect } from '@/lib/offer-redirect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  return handleOfferRedirect(request, (await context.params).slug);
}
