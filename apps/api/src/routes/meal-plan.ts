import { Router } from 'express';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import {
  mealPlanEntryInputSchema,
  mealPlanMoveSchema,
  mealPlanQuerySchema,
  type MealPlanEntry,
} from '@art-web/shared';
import type { Db } from '../db/client.js';
import { mealPlanEntries, recipes } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });

export function mealPlanRouter(db: Db) {
  const router = Router();

  /** Entries joined with the recipe title, in the JSON shape the frontend expects. */
  const selectEntries = () =>
    db
      .select({
        id: mealPlanEntries.id,
        date: mealPlanEntries.date,
        meal: mealPlanEntries.meal,
        kind: mealPlanEntries.kind,
        recipeId: mealPlanEntries.recipeId,
        recipeTitle: recipes.title,
        title: mealPlanEntries.title,
        isLeftover: mealPlanEntries.isLeftover,
      })
      .from(mealPlanEntries)
      // Left join: "eat out" and custom entries have no recipe but should still be returned.
      .leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id));

  async function getEntry(id: number): Promise<MealPlanEntry> {
    const [entry] = await selectEntries().where(eq(mealPlanEntries.id, id));
    if (!entry) throw new HttpError(404, 'Måltiden hittades inte');
    return entry;
  }

  // GET /api/meal-plan?from=2026-11-16&to=2026-11-22
  router.get('/', async (req, res) => {
    const { from, to } = mealPlanQuerySchema.parse(req.query);
    const entries: MealPlanEntry[] = await selectEntries()
      .where(and(gte(mealPlanEntries.date, from), lte(mealPlanEntries.date, to)))
      // Oldest first, so new entries land at the bottom of their slot.
      .orderBy(asc(mealPlanEntries.date), asc(mealPlanEntries.id));
    res.json(entries);
  });

  /**
   * Validates the body of a POST or PUT and turns it into column values.
   * Checks the recipe first, so a missing one gives a clear 400 instead of a
   * foreign-key error (which would surface as a 500).
   */
  async function toColumns(body: unknown) {
    const data = mealPlanEntryInputSchema.parse(body);
    if (data.recipeId != null) {
      const [recipe] = await db
        .select({ id: recipes.id })
        .from(recipes)
        .where(eq(recipes.id, data.recipeId));
      if (!recipe) throw new HttpError(400, 'Receptet finns inte');
    }
    return {
      date: data.date,
      meal: data.meal,
      kind: data.kind,
      recipeId: data.recipeId ?? null,
      title: data.title ?? null,
      isLeftover: data.isLeftover,
    };
  }

  router.post('/', async (req, res) => {
    const [row] = await db
      .insert(mealPlanEntries)
      .values(await toColumns(req.body))
      .returning({ id: mealPlanEntries.id });
    res.status(201).json(await getEntry(row!.id));
  });

  // PUT /api/meal-plan/5 replaces an entry: the way to change what is planned
  // (another recipe, another name) while it keeps its place in the slot.
  router.put('/:id', async (req, res) => {
    const { id } = idParam.parse(req.params);
    const updated = await db
      .update(mealPlanEntries)
      .set(await toColumns(req.body))
      .where(eq(mealPlanEntries.id, id))
      .returning({ id: mealPlanEntries.id });
    if (updated.length === 0) throw new HttpError(404, 'Måltiden hittades inte');
    res.json(await getEntry(id));
  });

  // PATCH /api/meal-plan/5 moves an entry to another day and/or meal.
  router.patch('/:id', async (req, res) => {
    const { id } = idParam.parse(req.params);
    const data = mealPlanMoveSchema.parse(req.body);
    const updated = await db
      .update(mealPlanEntries)
      .set(data)
      .where(eq(mealPlanEntries.id, id))
      .returning({ id: mealPlanEntries.id });
    if (updated.length === 0) throw new HttpError(404, 'Måltiden hittades inte');
    res.json(await getEntry(id));
  });

  router.delete('/:id', async (req, res) => {
    const { id } = idParam.parse(req.params);
    const deleted = await db
      .delete(mealPlanEntries)
      .where(eq(mealPlanEntries.id, id))
      .returning({ id: mealPlanEntries.id });
    if (deleted.length === 0) throw new HttpError(404, 'Måltiden hittades inte');
    res.status(204).end();
  });

  return router;
}
