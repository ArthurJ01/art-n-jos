/**
 * Code shared by the API and the web app.
 *
 * The Zod schemas here are the single source of truth for what a recipe looks like:
 * the API uses them to validate incoming requests, and the web app uses the
 * inferred TypeScript types (and can reuse the same validation in forms).
 */
import { z } from 'zod';

const trimmedLines = z.array(z.string().trim().min(1).max(500)).max(100).default([]);

const optionalMinutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60)
  .nullable()
  .optional();

/** A web address. Only http(s), so a link can never be a "javascript:" one. */
const webUrl = z.url({ protocol: /^https?$/ }).max(2000);

export const recipeInputSchema = z.object({
  title: z.string().trim().min(1, 'Titel krävs').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  servings: z.number().int().min(1).max(100).nullable().optional(),
  prepMinutes: optionalMinutes,
  cookMinutes: optionalMinutes,
  /** One per line. A line ending with a colon is a group heading: "Sås:". */
  ingredients: trimmedLines,
  /** One per line, with the same kind of headings as the ingredients. */
  steps: z.array(z.string().trim().min(1).max(2000)).max(100).default([]),
  tips: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
  sourceUrl: z
    .union([webUrl, z.literal('')])
    .nullable()
    .optional(),
  createdBy: z.string().trim().max(60).nullable().optional(),
});

/** What the client sends when creating/updating a recipe (before defaults are applied). */
export type RecipeInput = z.input<typeof recipeInputSchema>;
/** The validated, normalised version the API works with. */
export type RecipeData = z.output<typeof recipeInputSchema>;

/** A recipe as returned by the API. */
export interface Recipe {
  id: number;
  title: string;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[];
  steps: string[];
  tips: string | null;
  tags: string[];
  sourceUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Group headings inside ingredients and steps ----
//
// Ingredients and steps are plain lists of lines. A line that ends with a
// colon ("Sås:", "Till servering:") is a heading for the lines after it. That
// keeps a recipe easy to type, paste and import, with no extra structure.

/** "Sås:" is a heading, "2 dl grädde" is not. */
export const isHeadingLine = (line: string) => /[^:\s]\s*:+\s*$/.test(line);

/** "Sås:" → "Sås" */
export const headingText = (line: string) => line.replace(/[:\s]+$/, '').trim();

/** "Sås" → "Sås:" (the way a heading is stored) */
export const toHeadingLine = (text: string) => `${headingText(text)}:`;

export interface LineGroup {
  /** Null for the lines before the first heading. */
  heading: string | null;
  lines: string[];
}

/** Splits a list of lines into groups, one per heading. */
export function groupLines(lines: string[]): LineGroup[] {
  const groups: LineGroup[] = [];
  let current: LineGroup | undefined;
  for (const line of lines) {
    if (isHeadingLine(line)) {
      current = { heading: headingText(line), lines: [] };
      groups.push(current);
    } else {
      if (!current) {
        current = { heading: null, lines: [] };
        groups.push(current);
      }
      current.lines.push(line);
    }
  }
  return groups;
}

// ---- Import from a link ----

export const recipeImportSchema = z.object({ url: webUrl });

/** What "Hämta recept" found on a page: a draft to check and save, nothing stored yet. */
export interface RecipeImport {
  recipe: RecipeData;
  /**
   * `full` when the page describes its recipe in a way programs can read.
   * `basic` when only the title and description of the page could be used.
   */
  found: 'full' | 'basic';
}

export const recipeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().toLowerCase().max(40).optional(),
});
export type RecipeQuery = z.infer<typeof recipeQuerySchema>;

// ---- Meal plan ----

/** The three meals of a day, in the order they are shown. */
export const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
export type MealType = (typeof mealTypes)[number];

/**
 * What a meal plan entry is:
 * - `recipe`: one of the saved recipes
 * - `eat_out`: eating out, so there is no recipe
 * - `custom`: a meal without a recipe, named by hand ("Tacos hos mamma")
 */
export const mealPlanKinds = ['recipe', 'eat_out', 'custom'] as const;
export type MealPlanKind = (typeof mealPlanKinds)[number];

/** A calendar day without a time, as "YYYY-MM-DD". */
const isoDate = z.iso.date();

export const mealPlanEntryInputSchema = z
  .object({
    date: isoDate,
    meal: z.enum(mealTypes),
    kind: z.enum(mealPlanKinds),
    recipeId: z.number().int().positive().nullable().optional(),
    /** The name of a custom meal. Only custom meals have one. */
    title: z.string().trim().min(1, 'Namn krävs').max(100).nullable().optional(),
    /** True when this is a lunch box ("matlåda") made from an earlier meal. */
    isLeftover: z.boolean().default(false),
  })
  .refine((e) => (e.kind === 'recipe') === (e.recipeId != null), {
    path: ['recipeId'],
    message: 'recipeId krävs för recept och får inte anges annars',
  })
  .refine((e) => (e.kind === 'custom') === (e.title != null), {
    path: ['title'],
    message: 'title krävs för egna måltider och får inte anges annars',
  })
  .refine((e) => !(e.isLeftover && e.kind === 'eat_out'), {
    path: ['isLeftover'],
    message: 'Äta ute kan inte bli matlåda',
  });
export type MealPlanEntryInput = z.input<typeof mealPlanEntryInputSchema>;

/** Moving an entry to another day and/or meal. */
export const mealPlanMoveSchema = z.object({
  date: isoDate,
  meal: z.enum(mealTypes),
});
export type MealPlanMove = z.infer<typeof mealPlanMoveSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Which days to fetch, both ends included. At most about two months at a time. */
export const mealPlanQuerySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((r) => r.from <= r.to, { path: ['to'], message: 'to får inte vara före from' })
  .refine((r) => Date.parse(r.to) - Date.parse(r.from) <= 62 * DAY_MS, {
    path: ['to'],
    message: 'Högst 62 dagar åt gången',
  });
export type MealPlanQuery = z.infer<typeof mealPlanQuerySchema>;

/** A meal plan entry as returned by the API. */
export interface MealPlanEntry {
  id: number;
  date: string;
  meal: MealType;
  kind: MealPlanKind;
  recipeId: number | null;
  /** Title of the recipe, so the calendar doesn't need a second request. */
  recipeTitle: string | null;
  /** Name of a custom meal; null for the other kinds. */
  title: string | null;
  isLeftover: boolean;
}

// ---- Login ----
// You log in with your email address and a six-digit code: either one that is
// sent to the address, or the site's fixed PIN.

/** Tidied first, so " Anna@Example.com " and "anna@example.com" are the same address. */
const emailAddress = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const LOGIN_CODE_LENGTH = 6;

export const requestCodeSchema = z.object({ email: emailAddress });

export const verifyCodeSchema = z.object({
  email: emailAddress,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${LOGIN_CODE_LENGTH}}$`)),
});

export interface AuthStatus {
  authenticated: boolean;
  /** Whether the site has a fixed PIN to log in with, besides the emailed codes. */
  pinLogin: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  env: string;
  version: string;
  db: 'up' | 'down';
}

export interface ApiError {
  error: string;
  details?: unknown;
}
