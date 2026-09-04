import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  // Evita reabrir múltiplos pools de conexão durante reloads ou concorrência
  var _postgresClient: postgres.Sql | undefined;
}

const connectionString = process.env.DATABASE_URL || '';

const client =
  global._postgresClient ||
  postgres(connectionString, {
    prepare: false,
    max: 10, // Controla o limite de conexões por instância serverless
  });

if (process.env.NODE_ENV !== 'production') {
  global._postgresClient = client;
}

export const db = drizzle(client, { schema });

export function getDb() {
  return db;
}

export { schema };
