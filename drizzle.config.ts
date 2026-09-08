import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (!process.env.DATABASE_URL) {
  const envFile = ['.env', '../affiliate-arbitrage/.env'].find(existsSync);
  if (envFile) loadEnvFile(envFile);
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const endpoint = new URL(process.env.DATABASE_URL);

export default defineConfig({
  // ./drizzle contains historical SQLite snapshots; never apply it to production.
  out: './database/drizzle-postgres',
  schema: './db/schema.ts',
  dialect: 'postgresql',
  // Limit introspection to this schema; never propose deleting legacy tables.
  tablesFilter: ['products', 'offers', 'offer_price_history', 'click_analytics'],
  dbCredentials: {
    host: endpoint.hostname, port: Number(endpoint.port || 5432),
    user: decodeURIComponent(endpoint.username), password: decodeURIComponent(endpoint.password),
    database: decodeURIComponent(endpoint.pathname.slice(1)),
    ssl: { rejectUnauthorized: false },
  },
  strict: true,
  verbose: false,
});
