const base = new URL(process.env.PUBLIC_SITE_URL || 'https://empresa-online-ochre.vercel.app');
if (base.protocol !== 'https:' || !process.env.CRON_SECRET) throw new Error('HTTPS site URL and CRON_SECRET required');
// Drain the bounded queue in sequential batches; every request internally caps concurrency at five.
for (let batch = 0; batch < 10; batch += 1) {
  const response = await fetch(new URL('/api/cron/sync-offers', base), {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, redirect: 'error', signal: AbortSignal.timeout(65000),
  });
  const result = await response.json();
  console.log(JSON.stringify({ batch, httpStatus: response.status, status: result.status, updated: result.updated, failed: result.failed }));
  if (!response.ok) throw new Error(`Catalog sync failed: HTTP ${response.status}`);
  if (result.status === 'already_running' || result.checked < result.batchLimit || result.updated === 0) break;
}
