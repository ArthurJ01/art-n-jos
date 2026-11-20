import { Router } from 'express';
import { and, arrayContains, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  recipeInputSchema,
  recipeQuerySchema,
  type Recipe,
  type RecipeData,
} from '@art-web/shared';
import type { Db } from '../db/client.js';
import { recipes, type RecipeRow } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });

/** Convert a DB row into the JSON shape the frontend expects. */
function toDto(row: RecipeRow): Recipe {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Turn validated input into column values ('' and undefined become null). */
function toColumns(data: RecipeData) {
  return {
    title: data.title,
    description: data.description || null,
    servings: data.servings ?? null,
    prepMinutes: data.prepMinutes ?? null,
    cookMinutes: data.cookMinutes ?? null,
    ingredients: data.ingredients,
    steps: data.steps,
    tags: [...new Set(data.tags)],
    sourceUrl: data.sourceUrl || null,
    createdBy: data.createdBy || null,
  };
}

/** Escape % and _ so user input is matched literally inside ILIKE. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function recipesRouter(db: Db) {
  const router = Router();

  // GET /api/recipes?q=pasta&tag=vegetarian
  router.get('/', async (req, res) => {
    const { q, tag } = recipeQuerySchema.parse(req.query);
    const filters: SQL[] = [];
    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      filters.push(or(ilike(recipes.title, pattern), ilike(recipes.description, pattern))!);
    }
    if (tag) filters.push(arrayContains(recipes.tags, [tag]));

    const rows = await db
      .select()
      .from(recipes)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(recipes.createdAt));
    res.json(rows.map(toDto));
  });

  router.get('/:id', async (req, res) => {
    const { id } = idParam.parse(req.params);
    const [row] = await db.select().from(recipes).where(eq(recipes.id, id));
    if (!row) throw new HttpError(404, 'Recipe not found');
    res.json(toDto(row));
  });

  router.post('/', requireAuth, async (req, res) => {
    const data = recipeInputSchema.parse(req.body);
    const [row] = await db.insert(recipes).values(toColumns(data)).returning();
    res.status(201).json(toDto(row!));
  });

  router.put('/:id', requireAuth, async (req, res) => {
    const { id } = idParam.parse(req.params);
    const data = recipeInputSchema.parse(req.body);
    const [row] = await db
      .update(recipes)
      .set({ ...toColumns(data), updatedAt: new Date() })
      .where(eq(recipes.id, id))
      .returning();
    if (!row) throw new HttpError(404, 'Recipe not found');
    res.json(toDto(row));
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = idParam.parse(req.params);
    const deleted = await db
      .delete(recipes)
      .where(eq(recipes.id, id))
      .returning({ id: recipes.id });
    if (deleted.length === 0) throw new HttpError(404, 'Recipe not found');
    res.status(204).end();
  });

  return router;
}
