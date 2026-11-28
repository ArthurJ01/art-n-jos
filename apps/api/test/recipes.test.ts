import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { recipes } from '../src/db/schema.js';
import { createTestApp } from './helpers.js';

const { app, db, pool, loggedInAgent } = createTestApp();

const pasta = {
  title: 'Pasta',
  ingredients: ['200 g spaghetti'],
  steps: ['Boil'],
  tags: ['Pasta', 'quick'],
};

beforeEach(async () => {
  await db.delete(recipes);
});

afterAll(async () => {
  await pool.end();
});

describe('health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up', env: 'test' });
  });
});

describe('recipes', () => {
  it('requires login, to read recipes as well as to create them', async () => {
    await request(app).get('/api/recipes').expect(401);
    await request(app).get('/api/recipes/1').expect(401);
    await request(app).post('/api/recipes').send(pasta).expect(401);
  });

  it('creates, reads, updates and deletes a recipe', async () => {
    const agent = await loggedInAgent();

    const created = await agent.post('/api/recipes').send(pasta).expect(201);
    expect(created.body).toMatchObject({ title: 'Pasta', tags: ['pasta', 'quick'] });
    const id = created.body.id;

    const fetched = await agent.get(`/api/recipes/${id}`).expect(200);
    expect(fetched.body.ingredients).toEqual(['200 g spaghetti']);

    const updated = await agent
      .put(`/api/recipes/${id}`)
      .send({ ...pasta, title: 'Better pasta' })
      .expect(200);
    expect(updated.body.title).toBe('Better pasta');

    await agent.delete(`/api/recipes/${id}`).expect(204);
    await agent.get(`/api/recipes/${id}`).expect(404);
  });

  it('validates input', async () => {
    const agent = await loggedInAgent();
    const res = await agent.post('/api/recipes').send({ title: '' }).expect(400);
    expect(res.body.error).toBe('Ogiltig förfrågan');
  });

  it('searches by text and filters by tag', async () => {
    const agent = await loggedInAgent();
    await agent.post('/api/recipes').send(pasta).expect(201);
    await agent
      .post('/api/recipes')
      .send({ title: 'Pancakes', tags: ['breakfast'] })
      .expect(201);

    const byText = await agent.get('/api/recipes?q=pan').expect(200);
    expect(byText.body.map((r: { title: string }) => r.title)).toEqual(['Pancakes']);

    const byTag = await agent.get('/api/recipes?tag=quick').expect(200);
    expect(byTag.body.map((r: { title: string }) => r.title)).toEqual(['Pasta']);
  });

  it('returns 400 for a non-numeric id', async () => {
    const agent = await loggedInAgent();
    await agent.get('/api/recipes/abc').expect(400);
  });
});
