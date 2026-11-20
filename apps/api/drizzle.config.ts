import { defineConfig } from 'drizzle-kit';

// Used by `npm run db:generate` to diff src/db/schema.ts against previous migrations
// and write a new SQL migration file into ./drizzle. Commit those files!
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
