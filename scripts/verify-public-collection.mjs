import { loadEnvFile } from 'node:process';
import postgres from 'postgres';
const flag = process.argv.indexOf('--env');
if (flag >= 0) loadEnvFile(process.argv[flag + 1]);
let client;
try {
  if (!process.env.DATABASE_URL) throw new Error('database_url_missing');
  client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false }, connect_timeout: 10 });
  const rows = await client`select p.id as product_id, p.title, p.is_international, o.platform, o.currency,
    o.original_price, o.current_price, o.discount_percentage, o.last_checked_at
    from public.offers o join public.products p on p.id = o.product_id
    where o.reference_provenance like 'public_promo:%' and o.last_checked_at >= now() - interval '6 hours'
    order by o.platform, p.title`;
  console.table(rows);
  const unique = new Set(rows.map(row => row.product_id)).size;
  const national = rows.filter(row => !row.is_international).length;
  const international = rows.filter(row => row.is_international).length;
  console.table([{ productsConfirmed: unique, offersConfirmed: rows.length, national, international }]);
  if (unique < 10 || national === 0 || international === 0) {
    console.warn('Meta de 10 produtos nacionais/internacionais NÃO atingida. Não contabilizamos o catálogo legado como nova coleta.');
    process.exitCode = 1;
  }
} catch {
  console.error('verification_failed'); process.exitCode = 1;
} finally { await client?.end({ timeout: 5 }); }
