import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { classifyCategory, categoryFromDatabase } from '../lib/offers.ts';

let client;
try {
  if (!process.env.DATABASE_URL) throw new Error('database_url_missing');
  client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false }, connect_timeout: 10 });
  const migration = await readFile(new URL('../database/migrations/20260908_catalog_quality.sql', import.meta.url), 'utf8');
  await client.begin(async tx => {
    await tx`select pg_advisory_xact_lock(20260908, 11)`;
    await tx.unsafe(migration);
    const products = await tx`select id,title,category,subcategory from public.products`;
    for (const product of products) {
      const category = classifyCategory(product.title) ?? categoryFromDatabase(product.category, product.subcategory || '');
      await tx`update public.products set category = ${category} where id = ${product.id}`;
    }
  });
  console.info('Migração aplicada: categorias, cupons verificados e referências de preço auditadas.');
  console.table(await client`select count(*)::int as references_archived from public.catalog_reference_audit`);
} catch (error) {
  console.error('migration_failed', error.code || 'validation_or_network'); process.exitCode = 1;
} finally { await client?.end({ timeout: 5 }); }
