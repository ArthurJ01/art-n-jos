import { runMigrations } from '../src/db/migrate.js';
import { TEST_DATABASE_URL } from './helpers.js';

/** Runs once before all tests: make sure the test database has the latest schema. */
export default async function setup() {
  await runMigrations(TEST_DATABASE_URL);
}
