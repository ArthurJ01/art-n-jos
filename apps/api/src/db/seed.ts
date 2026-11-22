/** Inserts a few example recipes so local development isn't empty. */
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
    // Shows the group headings (a line ending with a colon) and the tips.
    title: 'Krämig kycklinggryta',
    description: 'En mild gryta med tomat och grädde som blir ännu godare dagen efter.',
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    ingredients: [
      'ca 500 g kycklingfilé',
      '2 vitlöksklyftor',
      '1 gul lök',
      '½ tsk salt',
      '2 msk rapsolja',
      'Sås:',
      '400 g krossade tomater',
      '2 dl matlagningsgrädde',
      '1 msk tomatpuré',
      '1 ½ tsk paprikapulver',
      'Till servering:',
      '3 dl ris',
      '1 kruka färsk koriander',
    ],
    steps: [
      'Skär kycklingen i bitar och salta. Hacka lök och vitlök.',
      'Bryn kycklingen i olja i en gryta, ca 5 min. Lägg åt sidan.',
      'Sås:',
      'Fräs lök och vitlök mjuka i samma gryta.',
      'Rör ner tomater, grädde, tomatpuré och paprikapulver. Låt sjuda 15 min.',
      'Lägg tillbaka kycklingen och sjud 5–7 min till. Smaka av med salt.',
      'Till servering:',
      'Koka riset enligt förpackningen.',
      'Servera grytan med ris och koriander.',
    ],
    tips: 'Passar bra som matlåda.\nByt grädden mot kokosmjölk för en mjölkfri variant.',
    tags: ['kyckling', 'gryta', 'middag'],
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
