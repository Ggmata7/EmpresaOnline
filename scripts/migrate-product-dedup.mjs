import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import postgres from 'postgres';

let client;
try {
  const flag = process.argv.indexOf('--env');
  const env = { ...process.env, ...parseEnv(readFileSync(flag < 0 ? '.env' : process.argv[flag + 1], 'utf8')) };
  if (!env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL ausente no ambiente informado.');
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL deve usar PostgreSQL.');
  client = postgres(env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false }, connect_timeout: 10,
    connection: { statement_timeout: 30000, lock_timeout: 10000 } });
  const migration = readFileSync(new URL('../database/migrations/20260908_product_dedup.sql', import.meta.url), 'utf8');
  await client.begin(async tx => { await tx.unsafe(migration); });
  console.info('Migração de deduplicação aplicada com sucesso.');
  const columns = await client`select table_name, column_name, data_type, is_generated
    from information_schema.columns where table_schema = 'public'
    and ((table_name = 'products' and column_name in ('normalized_title', 'is_international'))
      or (table_name = 'offers' and column_name in ('product_id', 'url', 'last_checked')))
    order by table_name, column_name`;
  console.table(columns);
  if (columns.length !== 5) throw new Error('schema_verification_failed');
} catch (error) {
  if (error.code === '42601') console.error('SQL syntax:', error.message, 'position:', error.position, 'internal position:', error.internal_position);
  console.error(error.message?.startsWith('DATABASE_URL') ? error.message : `Migração não aplicada (${error.code || 'validation_error'}); nenhuma alteração parcial.`);
  process.exitCode = 1;
} finally { await client?.end({ timeout: 5 }); }
