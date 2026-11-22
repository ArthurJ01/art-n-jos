import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { decodeEntities, durationMinutes, extractRecipe } from '../src/import/extract.js';
import {
  assertPublicUrl,
  fetchPage,
  isPublicAddress,
  PageFetchError,
  type FetchPage,
} from '../src/import/fetch-page.js';
import { createTestApp, TEST_PASSWORD } from './helpers.js';

/** A page with its recipe as JSON-LD, the way recipe sites publish it. */
const page = (jsonLd: unknown, head = '') => `<!doctype html>
<html><head><title>Sidans titel | Exempel</title>${head}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head><body><h1>Något helt annat</h1></body></html>`;

const pancakes = {
  '@context': 'https://schema.org/',
  '@type': 'Recipe',
  name: 'Pannkakor',
  description: 'Tunna pannkakor med sm&ouml;r &amp; sylt.',
  recipeYield: '4 port',
  prepTime: 'PT10M',
  totalTime: 'PT40M',
  recipeCategory: 'Middag, Barnfavorit',
  recipeCuisine: 'Svensk',
  keywords: 'pannkakor recept enkelt och snabbt för hela familjen, Ägg',
  recipeIngredient: ['2 &frac12; dl vetemjöl', ' 6 dl  mjölk ', '3 ägg', ''],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Vispa ihop mjöl och <b>hälften</b> av mjölken.' },
    { '@type': 'HowToStep', text: 'Vispa i resten av mjölken och äggen.' },
    { '@type': 'HowToStep', name: 'Stek tunna pannkakor i smör.' },
  ],
};

describe('extractRecipe', () => {
  it('reads a schema.org recipe from the page', () => {
    const result = extractRecipe(page(pancakes), 'https://example.com/pannkakor');
    expect(result).toEqual({
      found: 'full',
      recipe: {
        title: 'Pannkakor',
        description: 'Tunna pannkakor med smör & sylt.',
        servings: 4,
        // Only the total was given besides the prep time: the rest is cooking.
        prepMinutes: 10,
        cookMinutes: 30,
        ingredients: ['2 ½ dl vetemjöl', '6 dl mjölk', '3 ägg'],
        steps: [
          'Vispa ihop mjöl och hälften av mjölken.',
          'Vispa i resten av mjölken och äggen.',
          'Stek tunna pannkakor i smör.',
        ],
        // Category and cuisine, and keywords that are a word or two. Not search phrases.
        tags: ['middag', 'barnfavorit', 'svensk', 'ägg'],
        sourceUrl: 'https://example.com/pannkakor',
      },
    });
  });

  it('finds the recipe inside a list or an @graph, next to other things', () => {
    const inGraph = { '@graph': [{ '@type': 'WebSite', name: 'Exempel' }, pancakes] };
    const inList = [
      { '@type': 'Organization', name: 'Exempel' },
      { ...pancakes, type: 'Recipe' },
    ];
    const typeList = { ...pancakes, '@type': ['NewsArticle', 'Recipe'] };
    for (const jsonLd of [inGraph, inList, typeList]) {
      expect(extractRecipe(page(jsonLd), 'https://example.com/')?.recipe.title).toBe('Pannkakor');
    }
  });

  it('reads a block whose type is written with an HTML entity, as on arla.se', () => {
    const html = `<script data-x="1" type="application/ld&#x2B;json">${JSON.stringify(pancakes)}</script>`;
    expect(extractRecipe(html, 'https://example.com/')?.found).toBe('full');
  });

  it('skips a broken JSON-LD block and reads the next one', () => {
    const html = `<script type="application/ld+json">{ not json </script>${page(pancakes)}`;
    expect(extractRecipe(html, 'https://example.com/')?.found).toBe('full');
  });

  it('turns sections into headings, but not a lone placeholder section', () => {
    const step = (text: string) => ({ '@type': 'HowToStep', text });
    const section = (name: string, ...steps: string[]) => ({
      '@type': 'HowToSection',
      name,
      itemListElement: steps.map(step),
    });
    const withSections = (...sections: unknown[]) =>
      extractRecipe(page({ ...pancakes, recipeInstructions: sections }), 'https://example.com/')
        ?.recipe.steps;

    expect(
      withSections(section('Smet', 'Vispa.'), section('Stekning', 'Stek.', 'Servera.')),
    ).toEqual(['Smet:', 'Vispa.', 'Stekning:', 'Stek.', 'Servera.']);
    expect(withSections(section('Första instruktionen', 'Vispa.', 'Stek.'))).toEqual([
      'Vispa.',
      'Stek.',
    ]);
  });

  it('splits instructions written as one text, and keeps a step from becoming a heading', () => {
    const steps = (recipeInstructions: unknown) =>
      extractRecipe(page({ ...pancakes, recipeInstructions }), 'https://example.com/')?.recipe
        .steps;

    expect(steps('1. Vispa smeten.\n2. Stek i smör.\n\n3) Servera.')).toEqual([
      'Vispa smeten.',
      'Stek i smör.',
      'Servera.',
    ]);
    expect(steps('<ol><li>Vispa smeten.</li><li>Stek i smör.</li></ol>')).toEqual([
      'Vispa smeten.',
      'Stek i smör.',
    ]);
    // A step ending with a colon would otherwise be read as a group heading.
    expect(steps(['Blanda till marinaden:', 'Rör om.'])).toEqual([
      'Blanda till marinaden',
      'Rör om.',
    ]);
  });

  it('keeps what fits and drops what does not', () => {
    const odd = {
      ...pancakes,
      name: 'x'.repeat(300),
      recipeYield: ['ca 250 st', '12'],
      prepTime: 'om en stund',
      totalTime: 'P3D',
      recipeIngredient: Array.from({ length: 150 }, (_, i) => `${i + 1} ägg`),
    };
    const recipe = extractRecipe(page(odd), 'https://example.com/')?.recipe;
    expect(recipe?.title).toHaveLength(200);
    expect(recipe?.servings).toBeNull(); // 250 portions is not a serving size
    expect(recipe?.prepMinutes).toBeNull();
    expect(recipe?.cookMinutes).toBe(24 * 60);
    expect(recipe?.ingredients).toHaveLength(100);
  });

  it('falls back to the title and description of a page without recipe data', () => {
    const html = `<html><head><title>Mormors köttbullar &ndash; Bloggen</title>
      <meta content="De bästa köttbullarna." property="og:description"></head><body></body></html>`;
    expect(extractRecipe(html, 'https://example.com/kottbullar')).toEqual({
      found: 'basic',
      recipe: {
        title: 'Mormors köttbullar – Bloggen',
        description: 'De bästa köttbullarna.',
        ingredients: [],
        steps: [],
        tags: [],
        sourceUrl: 'https://example.com/kottbullar',
      },
    });
    expect(extractRecipe('<html><body>Tomt</body></html>', 'https://example.com/')).toBeNull();
  });
});

describe('import helpers', () => {
  it('reads ISO 8601 durations as minutes', () => {
    expect(durationMinutes('PT45M')).toBe(45);
    expect(durationMinutes('PT1H30M')).toBe(90);
    expect(durationMinutes('P0DT0H20M')).toBe(20);
    expect(durationMinutes('PT1.5H')).toBe(90);
    expect(durationMinutes('pt00m')).toBe(0);
    expect(durationMinutes('30')).toBe(30);
    expect(durationMinutes('en halvtimme')).toBeNull();
    expect(durationMinutes(undefined)).toBeNull();
  });

  it('decodes HTML entities', () => {
    expect(decodeEntities('Sm&ouml;r &amp; r&#229;g &#xE4;r gott &okänd;')).toBe(
      'Smör & råg är gott &okänd;',
    );
  });
});

describe('page fetching guard', () => {
  it('only accepts public IP addresses', () => {
    for (const address of ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']) {
      expect(isPublicAddress(address), address).toBe(true);
    }
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      '::',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1', // IPv4 dressed up as IPv6
      '::ffff:10.0.0.1',
      'not-an-address',
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it('refuses addresses that are not ordinary web pages', () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://[::1]/',
      'http://2130706433/', // 127.0.0.1 written as one number
      'http://192.168.0.10/recept',
      'https://example.com:8443/',
      'https://user:secret@example.com/',
      'ftp://example.com/',
    ]) {
      expect(() => assertPublicUrl(new URL(url)), url).toThrow(PageFetchError);
    }
    expect(() => assertPublicUrl(new URL('https://www.example.com/recept/1'))).not.toThrow();
  });

  it('refuses a host name that points at this machine', async () => {
    // "localhost" is looked up while connecting; the answer is not a public address.
    await expect(fetchPage('http://localhost/')).rejects.toThrow(PageFetchError);
    await expect(fetchPage('http://127.0.0.1/')).rejects.toThrow(PageFetchError);
  });
});

describe('POST /api/recipes/import', () => {
  /** A stand-in for the internet: every address has the pancake recipe, except /missing. */
  const requested: string[] = [];
  const fakeFetchPage: FetchPage = async (url) => {
    requested.push(url);
    if (url.endsWith('/missing')) throw new PageFetchError('Sidan gick inte att hämta.');
    if (url.endsWith('/empty')) return { html: '<html></html>', url };
    return { html: page(pancakes), url: `${url}?efter-omdirigering` };
  };
  const { app, pool } = createTestApp({ fetchPage: fakeFetchPage });

  async function loggedInAgent() {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ password: TEST_PASSWORD }).expect(200);
    return agent;
  }

  afterAll(async () => {
    await pool.end();
  });

  it('requires login', async () => {
    await request(app)
      .post('/api/recipes/import')
      .send({ url: 'https://example.com/pannkakor' })
      .expect(401);
    expect(requested).toEqual([]);
  });

  it('returns the recipe as a draft, without saving it', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .post('/api/recipes/import')
      .send({ url: 'https://example.com/pannkakor' })
      .expect(200);

    expect(res.body.found).toBe('full');
    expect(res.body.recipe).toMatchObject({
      title: 'Pannkakor',
      servings: 4,
      ingredients: ['2 ½ dl vetemjöl', '6 dl mjölk', '3 ägg'],
      // The address the page ended up on, after redirects.
      sourceUrl: 'https://example.com/pannkakor?efter-omdirigering',
    });
    expect(requested).toEqual(['https://example.com/pannkakor']);

    const list = await request(app).get('/api/recipes?q=Pannkakor').expect(200);
    expect(list.body).toEqual([]);
  });

  it('only takes http(s) addresses', async () => {
    const agent = await loggedInAgent();
    for (const url of ['', 'pannkakor', 'file:///etc/passwd', 'javascript:alert(1)']) {
      await agent.post('/api/recipes/import').send({ url }).expect(400);
    }
  });

  it('says so when the page can not be fetched or holds no recipe', async () => {
    const agent = await loggedInAgent();
    const missing = await agent
      .post('/api/recipes/import')
      .send({ url: 'https://example.com/missing' })
      .expect(422);
    expect(missing.body.error).toBe('Sidan gick inte att hämta.');

    const empty = await agent
      .post('/api/recipes/import')
      .send({ url: 'https://example.com/empty' })
      .expect(422);
    expect(empty.body.error).toBe('Hittade inget recept på den sidan.');
  });
});
