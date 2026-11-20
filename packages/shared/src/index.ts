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

export const recipeInputSchema = z.object({
  title: z.string().trim().min(1, 'Titel krävs').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  servings: z.number().int().min(1).max(100).nullable().optional(),
  prepMinutes: optionalMinutes,
  cookMinutes: optionalMinutes,
  ingredients: trimmedLines,
  steps: z.array(z.string().trim().min(1).max(2000)).max(100).default([]),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
  sourceUrl: z
    .union([z.url(), z.literal('')])
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
  tags: string[];
  sourceUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const recipeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().toLowerCase().max(40).optional(),
});
export type RecipeQuery = z.infer<typeof recipeQuerySchema>;

export const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

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
