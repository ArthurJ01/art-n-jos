/**
 * Applies any SQL migrations in ./drizzle that haven't run yet.
 *
 * - Locally:     npm run db:migrate
 * - In CI/CD:    the deploy workflow runs the same command with each environment's DATABASE_URL
 *
 * Drizzle records applied migrations in a `__drizzle_migrations` table, so running
 * this twice is safe.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client.js';

export async function runMigrations(databaseUrl: string) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Works both from src/db (tsx) and dist/db (bundled): the folder is apps/api/drizzle.
  const migrationsFolder = path.resolve(here, '../../drizzle');
  const { db, pool } = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Migrations applied'))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
