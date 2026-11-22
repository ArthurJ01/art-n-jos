import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { mealPlanEntries, recipes } from '../src/db/schema.js';
import { createTestApp, TEST_PASSWORD } from './helpers.js';

const { app, db, pool } = createTestApp();

async function loggedInAgent() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ password: TEST_PASSWORD }).expect(200);
  return agent;
}

/** Inserts a recipe straight into the database and returns its id. */
async function createRecipe(title = 'Pasta') {
  const [row] = await db.insert(recipes).values({ title }).returning({ id: recipes.id });
  return row!.id;
}

const week = '/api/meal-plan?from=2026-11-16&to=2026-11-22';

beforeEach(async () => {
  await db.delete(mealPlanEntries);
  await db.delete(recipes);
});

afterAll(async () => {
  await pool.end();
});

describe('meal plan', () => {
  it('requires login to change the plan', async () => {
    const body = { date: '2026-11-16', meal: 'dinner', kind: 'eat_out' };
    await request(app).post('/api/meal-plan').send(body).expect(401);
    await request(app).patch('/api/meal-plan/1').send(body).expect(401);
    await request(app).put('/api/meal-plan/1').send(body).expect(401);
    await request(app).delete('/api/meal-plan/1').expect(401);
  });

  it('plans a recipe and shows it to everyone, with the recipe title', async () => {
    const agent = await loggedInAgent();
    const recipeId = await createRecipe('Lasagne');

    const created = await agent
      .post('/api/meal-plan')
      .send({ date: '2026-11-17', meal: 'dinner', kind: 'recipe', recipeId })
      .expect(201);
    expect(created.body).toMatchObject({
      date: '2026-11-17',
      meal: 'dinner',
      kind: 'recipe',
      recipeId,
      recipeTitle: 'Lasagne',
      title: null,
      isLeftover: false,
    });

    // No login needed to read.
    const list = await request(app).get(week).expect(200);
    expect(list.body).toEqual([created.body]);
  });

  it('allows several entries in one slot, including eating out and a lunch box', async () => {
    const agent = await loggedInAgent();
    const recipeId = await createRecipe();
    const slot = { date: '2026-11-18', meal: 'lunch' };

    await agent
      .post('/api/meal-plan')
      .send({ ...slot, kind: 'recipe', recipeId, isLeftover: true })
      .expect(201);
    await agent
      .post('/api/meal-plan')
      .send({ ...slot, kind: 'eat_out' })
      .expect(201);

    const list = await request(app).get(week).expect(200);
    expect(list.body).toMatchObject([
      { kind: 'recipe', isLeftover: true },
      { kind: 'eat_out', recipeId: null, recipeTitle: null },
    ]);
  });

  it('plans a custom meal without a recipe, and its lunch box', async () => {
    const agent = await loggedInAgent();
    const created = await agent
      .post('/api/meal-plan')
      .send({ date: '2026-11-19', meal: 'dinner', kind: 'custom', title: '  Tacos hos mamma ' })
      .expect(201);
    expect(created.body).toMatchObject({
      kind: 'custom',
      recipeId: null,
      recipeTitle: null,
      title: 'Tacos hos mamma',
      isLeftover: false,
    });

    await agent
      .post('/api/meal-plan')
      .send({ date: '2026-11-20', meal: 'lunch', kind: 'custom', title: 'Tacos', isLeftover: true })
      .expect(201);

    const list = await request(app).get(week).expect(200);
    expect(list.body).toMatchObject([
      { kind: 'custom', title: 'Tacos hos mamma' },
      { kind: 'custom', title: 'Tacos', isLeftover: true },
    ]);
  });

  it('only returns entries inside the requested days', async () => {
    const agent = await loggedInAgent();
    for (const date of ['2026-11-15', '2026-11-16', '2026-11-22', '2026-11-23']) {
      await agent.post('/api/meal-plan').send({ date, meal: 'dinner', kind: 'eat_out' });
    }
    const list = await request(app).get(week).expect(200);
    expect(list.body.map((e: { date: string }) => e.date)).toEqual(['2026-11-16', '2026-11-22']);
  });

  it('moves and deletes an entry', async () => {
    const agent = await loggedInAgent();
    const created = await agent
      .post('/api/meal-plan')
      .send({ date: '2026-11-16', meal: 'dinner', kind: 'eat_out' })
      .expect(201);
    const id = created.body.id;

    const moved = await agent
      .patch(`/api/meal-plan/${id}`)
      .send({ date: '2026-11-19', meal: 'lunch' })
      .expect(200);
    expect(moved.body).toMatchObject({ id, date: '2026-11-19', meal: 'lunch' });

    await agent.delete(`/api/meal-plan/${id}`).expect(204);
    await agent.delete(`/api/meal-plan/${id}`).expect(404);
    const list = await request(app).get(week).expect(200);
    expect(list.body).toEqual([]);
  });

  it('replaces what an entry is, keeping its id and place', async () => {
    const agent = await loggedInAgent();
    const recipeId = await createRecipe('Lasagne');
    const slot = { date: '2026-11-17', meal: 'dinner' };
    const created = await agent
      .post('/api/meal-plan')
      .send({ ...slot, kind: 'custom', title: 'Lasange' })
      .expect(201);
    const id = created.body.id;

    // Fix the spelling of a typed meal...
    const renamed = await agent
      .put(`/api/meal-plan/${id}`)
      .send({ ...slot, kind: 'custom', title: 'Lasagne hos mamma' })
      .expect(200);
    expect(renamed.body).toMatchObject({ id, kind: 'custom', title: 'Lasagne hos mamma' });

    // ...or swap it for a recipe.
    const swapped = await agent
      .put(`/api/meal-plan/${id}`)
      .send({ ...slot, kind: 'recipe', recipeId })
      .expect(200);
    expect(swapped.body).toEqual({
      id,
      ...slot,
      kind: 'recipe',
      recipeId,
      recipeTitle: 'Lasagne',
      title: null,
      isLeftover: false,
    });

    // The same rules as when creating one.
    await agent
      .put(`/api/meal-plan/${id}`)
      .send({ ...slot, kind: 'recipe', recipeId: 999999 })
      .expect(400);
    await agent
      .put(`/api/meal-plan/${id}`)
      .send({ ...slot, kind: 'custom' })
      .expect(400);
    await agent
      .put('/api/meal-plan/999999')
      .send({ ...slot, kind: 'eat_out' })
      .expect(404);

    const list = await request(app).get(week).expect(200);
    expect(list.body).toEqual([swapped.body]);
  });

  it('removes a recipe from the plan when the recipe is deleted', async () => {
    const agent = await loggedInAgent();
    const recipeId = await createRecipe();
    await agent
      .post('/api/meal-plan')
      .send({ date: '2026-11-16', meal: 'dinner', kind: 'recipe', recipeId })
      .expect(201);

    await agent.delete(`/api/recipes/${recipeId}`).expect(204);
    const list = await request(app).get(week).expect(200);
    expect(list.body).toEqual([]);
  });

  it('validates input', async () => {
    const agent = await loggedInAgent();
    const base = { date: '2026-11-16', meal: 'dinner' };
    // A recipe entry needs a recipe, and it has to exist.
    await agent
      .post('/api/meal-plan')
      .send({ ...base, kind: 'recipe' })
      .expect(400);
    await agent
      .post('/api/meal-plan')
      .send({ ...base, kind: 'recipe', recipeId: 999999 })
      .expect(400);
    // Eating out can't have a recipe or be a lunch box.
    await agent
      .post('/api/meal-plan')
      .send({ ...base, kind: 'eat_out', isLeftover: true })
      .expect(400);
    // A custom meal needs a name, and only custom meals have one.
    await agent
      .post('/api/meal-plan')
      .send({ ...base, kind: 'custom' })
      .expect(400);
    await agent
      .post('/api/meal-plan')
      .send({ ...base, kind: 'custom', title: '   ' })
      .expect(400);
    await agent
      .post('/api/meal-plan')
      .send({ ...base, kind: 'custom', title: 'x'.repeat(101) })
      .expect(400);
    await agent
      .post('/api/meal-plan')
      .send({ ...base, kind: 'eat_out', title: 'Pizza' })
      .expect(400);
    await agent
      .post('/api/meal-plan')
      .send({ ...base, meal: 'brunch', kind: 'eat_out' })
      .expect(400);
    await agent
      .post('/api/meal-plan')
      .send({ date: '2026-02-30', meal: 'dinner', kind: 'eat_out' })
      .expect(400);

    await request(app).get('/api/meal-plan').expect(400);
    await request(app).get('/api/meal-plan?from=2026-11-22&to=2026-11-16').expect(400);
    await request(app).get('/api/meal-plan?from=2026-01-01&to=2026-12-31').expect(400);
  });
});
