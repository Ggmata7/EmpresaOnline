import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for normalized catalog writes.');
  const endpoint = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(endpoint.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(endpoint.hostname);
  const client = postgres(connectionString, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    // Explicit deployment choice: encrypted transport without certificate verification.
    ssl: local ? false : { rejectUnauthorized: false },
    connection: { application_name: 'catch', statement_timeout: 15000 },
  });
  return { client, db: drizzle(client, { schema }) };
}

declare global {
  var _catchDatabase: ReturnType<typeof createDatabase> | undefined;
}

// Lazy initialization avoids opening sockets at build time; one pool per warm instance.
export function getDb() {
  globalThis._catchDatabase ??= createDatabase();
  return globalThis._catchDatabase.db;
}

export { schema };
