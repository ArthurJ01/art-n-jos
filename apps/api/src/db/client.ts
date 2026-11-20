import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export function createDb(databaseUrl: string) {
  // A pool keeps a few connections open and reuses them between requests.
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>['db'];
