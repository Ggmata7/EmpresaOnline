import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { syncOffers } from '@/lib/sync-offers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const headers = { 'Cache-Control': 'no-store' };
  if (!secret || secret.length < 32) return NextResponse.json({ error: 'cron_not_configured' }, { status: 503, headers });
  const authorization = request.headers.get('authorization') ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
  if (process.env.CATALOG_SCHEMA_VERSION !== '2' || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'normalized_database_not_configured' }, { status: 503, headers });
  }
  try {
    const summary = await syncOffers();
    if (summary.updated > 0) {
      for (const path of ['/', '/brasil', '/global']) revalidatePath(path);
    }
    console.info('[sync-offers]', JSON.stringify(summary));
    return NextResponse.json(summary, { status: summary.status === 'not_configured' ? 503 : summary.failed > 0 && summary.updated === 0 ? 502 : 200, headers });
  } catch {
    console.error('[sync-offers] transaction_failed');
    return NextResponse.json({ error: 'sync_failed', message: 'No partial database batch was committed.' }, { status: 503, headers });
  }
}

export const POST = GET;
