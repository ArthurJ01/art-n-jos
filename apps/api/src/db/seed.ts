/** Inserts a couple of example recipes so local development isn't empty. */
import { createDb } from './client.js';
import { recipes } from './schema.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const { db, pool } = createDb(url);

await db.insert(recipes).values([
  {
    title: 'Pasta aglio e olio',
    description: 'Fast weeknight pasta with garlic, chili and olive oil.',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 12,
    ingredients: [
      '200 g spaghetti',
      '4 cloves garlic, thinly sliced',
      '1 tsp chili flakes',
      '60 ml olive oil',
      'Parsley',
    ],
    steps: [
      'Boil the pasta in well-salted water.',
      'Gently fry garlic and chili in the oil until golden.',
      'Toss pasta with the oil and a splash of pasta water. Finish with parsley.',
    ],
    tags: ['pasta', 'vegetarian', 'quick'],
    createdBy: 'Arthur',
  },
  {
    title: 'Overnight oats',
    servings: 1,
    prepMinutes: 5,
    ingredients: ['50 g oats', '120 ml milk', '1 tbsp chia seeds', 'Berries'],
    steps: ['Mix everything in a jar.', 'Leave in the fridge overnight.'],
    tags: ['breakfast', 'vegetarian'],
  },
]);

console.log('Seeded example recipes');
await pool.end();
