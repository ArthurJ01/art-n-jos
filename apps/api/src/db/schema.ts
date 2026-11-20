import { sql } from 'drizzle-orm';
import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Database tables, defined in TypeScript.
 * After changing this file run `npm run db:generate` to create a migration.
 */
export const recipes = pgTable(
  'recipes',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    servings: integer('servings'),
    prepMinutes: integer('prep_minutes'),
    cookMinutes: integer('cook_minutes'),
    ingredients: text('ingredients')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    steps: text('steps')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sourceUrl: text('source_url'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('recipes_tags_idx').using('gin', t.tags)],
);

export type RecipeRow = typeof recipes.$inferSelect;
