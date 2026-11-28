import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { MealPlanKind, MealType } from '@art-web/shared';

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
    // Free text shown under the steps ("Blir ännu godare dagen efter").
    tips: text('tips'),
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

/**
 * Login codes that have been emailed and not used yet. A row is short-lived:
 * it is deleted when the code is used, or an hour after it was made.
 */
export const loginCodes = pgTable(
  'login_codes',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    // Never the code itself, so reading this table is not enough to log in.
    codeHash: text('code_hash').notNull(),
    // How many times someone has tried to guess this code.
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('login_codes_email_idx').on(t.email)],
);

/**
 * One thing planned for one meal on one day. A slot (say Tuesday dinner) can
 * hold several entries, so there is no unique constraint on (date, meal).
 */
export const mealPlanEntries = pgTable(
  'meal_plan_entries',
  {
    id: serial('id').primaryKey(),
    // A plain calendar day. mode 'string' keeps it as "YYYY-MM-DD" instead of a
    // JS Date, which would drag time zones into something that has none.
    date: date('date', { mode: 'string' }).notNull(),
    meal: text('meal').$type<MealType>().notNull(),
    kind: text('kind').$type<MealPlanKind>().notNull(),
    // Deleting a recipe also removes it from the plan.
    recipeId: integer('recipe_id').references(() => recipes.id, { onDelete: 'cascade' }),
    // The name of a custom meal (kind 'custom'), which has no recipe.
    title: text('title'),
    isLeftover: boolean('is_leftover').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('meal_plan_entries_date_idx').on(t.date),
    // The API validates these too; the checks make sure the data stays sane
    // even if something else writes to the table.
    check('meal_plan_entries_meal_check', sql`${t.meal} in ('breakfast', 'lunch', 'dinner')`),
    check('meal_plan_entries_kind_check', sql`${t.kind} in ('recipe', 'eat_out', 'custom')`),
    check(
      'meal_plan_entries_recipe_check',
      sql`(${t.kind} = 'recipe') = (${t.recipeId} is not null)`,
    ),
    check('meal_plan_entries_title_check', sql`(${t.kind} = 'custom') = (${t.title} is not null)`),
  ],
);
