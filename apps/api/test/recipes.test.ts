import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { recipes } from '../src/db/schema.js';
import { createTestApp, TEST_PASSWORD } from './helpers.js';

const { app, db, pool } = createTestApp();

/** Logs in and returns an agent that keeps the session cookie between requests. */
async function loggedInAgent() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ password: TEST_PASSWORD }).expect(200);
  return agent;
}

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

describe('auth', () => {
  it('rejects a wrong password', async () => {
    await request(app).post('/api/auth/login').send({ password: 'nope' }).expect(401);
  });

  it('remembers a logged in user', async () => {
    const agent = await loggedInAgent();
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body).toEqual({ authenticated: true });
  });
});

describe('recipes', () => {
  it('requires login to create', async () => {
    await request(app).post('/api/recipes').send(pasta).expect(401);
  });

  it('creates, reads, updates and deletes a recipe', async () => {
    const agent = await loggedInAgent();

    const created = await agent.post('/api/recipes').send(pasta).expect(201);
    expect(created.body).toMatchObject({ title: 'Pasta', tags: ['pasta', 'quick'] });
    const id = created.body.id;

    const fetched = await request(app).get(`/api/recipes/${id}`).expect(200);
    expect(fetched.body.ingredients).toEqual(['200 g spaghetti']);

    const updated = await agent
      .put(`/api/recipes/${id}`)
      .send({ ...pasta, title: 'Better pasta' })
      .expect(200);
    expect(updated.body.title).toBe('Better pasta');

    await agent.delete(`/api/recipes/${id}`).expect(204);
    await request(app).get(`/api/recipes/${id}`).expect(404);
  });

  it('validates input', async () => {
    const agent = await loggedInAgent();
    const res = await agent.post('/api/recipes').send({ title: '' }).expect(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('searches by text and filters by tag', async () => {
    const agent = await loggedInAgent();
    await agent.post('/api/recipes').send(pasta).expect(201);
    await agent
      .post('/api/recipes')
      .send({ title: 'Pancakes', tags: ['breakfast'] })
      .expect(201);

    const byText = await request(app).get('/api/recipes?q=pan').expect(200);
    expect(byText.body.map((r: { title: string }) => r.title)).toEqual(['Pancakes']);

    const byTag = await request(app).get('/api/recipes?tag=quick').expect(200);
    expect(byTag.body.map((r: { title: string }) => r.title)).toEqual(['Pasta']);
  });

  it('returns 400 for a non-numeric id', async () => {
    await request(app).get('/api/recipes/abc').expect(400);
  });
});
