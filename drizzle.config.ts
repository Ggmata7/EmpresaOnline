import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // ./drizzle contains historical SQLite snapshots; never apply it to production.
  out: './database/drizzle-postgres',
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: false,
});
