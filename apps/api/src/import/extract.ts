/**
 * Turns the HTML of a recipe page into a recipe draft.
 *
 * Most recipe sites describe their recipe twice: once as the page you see,
 * and once in a form made for programs, a
 * `<script type="application/ld+json">` block that follows
 * https://schema.org/Recipe (it is what gives them recipe cards in Google).
 * That block is what we read, so one piece of code works for Arla, ICA and
 * most other sites, without knowing what any of them look like. The one
 * thing it lacks is the grouping of the ingredients ("Sås:"), which
 * groups.ts reads from the visible page instead.
 *
 * Everything in here is plain text handling with no network access, which
 * makes it easy to test with a saved piece of HTML.
 */
import {
  headingText,
  recipeInputSchema,
  toHeadingLine,
  type RecipeImport,
  type RecipeInput,
} from '@art-web/shared';
import { groupIngredients } from './groups.js';
import { decodeEntities } from './text.js';

/** A value from JSON we know nothing about yet. */
type Json = unknown;
type JsonObject = Record<string, Json>;

const isObject = (value: Json): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON-LD allows one value or a list of them almost everywhere. */
const toList = (value: Json): Json[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];

// ---- Text clean-up ----

/** Plain text on one line: entities decoded, tags removed, whitespace tidied. */
function cleanText(value: Json): string {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return '';
  return decodeEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Text that may hold several lines (HTML lists, paragraphs or line breaks). */
function cleanLines(value: Json): string[] {
  if (typeof value !== 'string') return [];
  return decodeEntities(value)
    .replace(/<\/(?:li|p|div|h\d)>|<br\s*\/?>/gi, '\n')
    .split('\n')
    .map(cleanText)
    .map((line) => line.replace(/^(?:steg\s+)?\d+\s*[.):]\s+/i, '')) // "1. Koka" → "Koka"
    .filter(Boolean);
}

// ---- Finding the recipe in the page ----

/** The contents of every JSON-LD block in the page, parsed. Broken blocks are skipped. */
function jsonLdBlocks(html: string): Json[] {
  const blocks: Json[] = [];
  for (const [, attributes = '', body = ''] of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
  )) {
    // The type is decoded first: Arla writes it as "application/ld&#x2B;json",
    // which is the same thing to a browser.
    if (!/application\/ld\+json/i.test(decodeEntities(attributes))) continue;
    const text = body.replace(
      /^\s*(?:<!--|\/\/<!\[CDATA\[|<!\[CDATA\[)|(?:-->|\/\/\]\]>|\]\]>)\s*$/g,
      '',
    );
    try {
      blocks.push(JSON.parse(text));
    } catch {
      try {
        // A common mistake: real line breaks inside a text, which JSON forbids.
        blocks.push(JSON.parse(text.replace(/[\n\r\t]+/g, ' ')));
      } catch {
        // Not JSON we can read; other blocks may still be fine.
      }
    }
  }
  return blocks;
}

const isType = (node: JsonObject, type: string) =>
  // "@type": "Recipe", ["Recipe", "NewsArticle"] or "https://schema.org/Recipe".
  // (Arla also writes a plain "type", so that is accepted as well.)
  [...toList(node['@type']), ...toList(node.type)].some(
    (t) => typeof t === 'string' && t.toLowerCase().split('/').pop() === type,
  );

/** Looks through nested lists and "@graph" collections for the first recipe. */
function findRecipe(node: Json, depth = 0): JsonObject | null {
  if (depth > 6) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(node)) return null;
  if (isType(node, 'recipe')) return node;
  return findRecipe(node['@graph'], depth + 1) ?? findRecipe(node.mainEntity, depth + 1);
}

// ---- Reading the fields ----

/** "4 port" → 4, ["4", "4 portioner"] → 4 */
function firstInteger(value: Json): number | null {
  for (const item of toList(value)) {
    const match = /\d+/.exec(cleanText(item));
    if (match) return Number(match[0]);
  }
  return null;
}

/** An ISO 8601 duration in minutes: "PT1H30M" → 90. A bare number counts as minutes. */
export function durationMinutes(value: Json): number | null {
  const text = cleanText(value).toUpperCase();
  if (/^\d+$/.test(text)) return Number(text);
  const match =
    /^P(?:(\d+)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:\d+(?:[.,]\d+)?S)?)?$/.exec(
      text,
    );
  if (!match) return null;
  const [, days = '0', hours = '0', minutes = '0'] = match;
  const number = (s: string) => Number(s.replace(',', '.'));
  return Math.round(number(days) * 24 * 60 + number(hours) * 60 + number(minutes));
}

/** A HowToSection: a named group with its own list of steps. */
const hasSteps = (item: Json): item is JsonObject & { itemListElement: Json } =>
  isObject(item) && 'itemListElement' in item;

/**
 * The steps, as lines. Sites write them as one long text, a list of texts, a
 * list of HowToStep objects, or HowToSection objects with steps inside. A
 * section name becomes a heading line ("Sås:"), but only when there are
 * several sections: a single one is often just a placeholder name.
 */
function instructionLines(value: Json): string[] {
  const items = toList(value);
  const useHeadings = items.filter(hasSteps).length > 1;
  return items.flatMap((item): string[] => {
    if (typeof item === 'string') return stepLines(item);
    if (!isObject(item)) return [];
    if (hasSteps(item)) {
      const name = cleanText(item.name);
      const steps = instructionLines(item.itemListElement);
      return useHeadings && name ? [toHeadingLine(name), ...steps] : steps;
    }
    const text = stepLines(item.text);
    return text.length > 0 ? text : stepLines(item.name);
  });
}

/**
 * The lines of one step. A colon at the end is removed ("Blanda till
 * marinaden:"), since a line that ends with one is stored as a heading.
 */
const stepLines = (value: Json) => cleanLines(value).map(headingText).filter(Boolean);

const MAX_TAGS = 8;

/** "Huvudrätt, Middag" → ["huvudrätt", "middag"] */
const splitTags = (value: Json) =>
  toList(value)
    .flatMap((item) => cleanText(item).split(','))
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length <= 30);

/**
 * Category and cuisine as tags, and the keywords that look like tags.
 * "keywords" is often written for search engines ("enkel pannkaka recept
 * snabbt"), and such phrases would only clutter the tag filter.
 */
function tagsFrom(recipe: JsonObject): string[] {
  const keywords = splitTags(recipe.keywords).filter((tag) => tag.split(' ').length <= 2);
  const tags = [
    ...splitTags(recipe.recipeCategory),
    ...splitTags(recipe.recipeCuisine),
    ...keywords,
  ];
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

function recipeFromJsonLd(recipe: JsonObject, pageUrl: string, html: string): RecipeInput {
  let prep = durationMinutes(recipe.prepTime) || null;
  let cook = durationMinutes(recipe.cookTime) || null;
  const total = durationMinutes(recipe.totalTime) || null;
  // Many sites only give the total. Put what is unaccounted for where it fits,
  // so that prep + cook adds up to the time the site shows.
  if (total && !prep && !cook) cook = total;
  else if (total && prep && !cook && total > prep) cook = total - prep;
  else if (total && cook && !prep && total > cook) prep = total - cook;

  const minutes = (value: number | null) => (value === null ? null : Math.min(value, 24 * 60));
  const servings = firstInteger(recipe.recipeYield);
  // "ingredients" is the older name of the same field.
  const ingredients = toList(recipe.recipeIngredient ?? recipe.ingredients)
    .map((line) => cleanText(line).slice(0, 500))
    .filter(Boolean);

  return {
    title: (cleanText(recipe.name) || cleanText(recipe.headline)).slice(0, 200),
    description: cleanText(recipe.description).slice(0, 2000) || null,
    servings: servings && servings >= 1 && servings <= 100 ? servings : null,
    prepMinutes: minutes(prep),
    cookMinutes: minutes(cook),
    ingredients: groupIngredients(ingredients, html).slice(0, 100),
    steps: instructionLines(recipe.recipeInstructions)
      .map((line) => line.slice(0, 2000))
      .slice(0, 100),
    tags: tagsFrom(recipe),
    sourceUrl: pageUrl,
  };
}

// ---- Pages without recipe data ----

/** The content of a <meta> tag, by its name or property ("og:title"). */
function metaContent(html: string, key: string): string {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attribute = (name: string) =>
      new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
        .exec(tag)
        ?.slice(1)
        .find(Boolean);
    const name = attribute('property') ?? attribute('name');
    if (name?.toLowerCase() === key) return cleanText(attribute('content') ?? '');
  }
  return '';
}

function recipeFromMeta(html: string, pageUrl: string): RecipeInput {
  const title =
    metaContent(html, 'og:title') || cleanText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]);
  const description = metaContent(html, 'og:description') || metaContent(html, 'description');
  return {
    title: title.slice(0, 200),
    description: description.slice(0, 2000) || null,
    sourceUrl: pageUrl,
  };
}

/**
 * The recipe on a page, as a draft for the recipe form. Null when the page
 * has nothing to go on, not even a title.
 */
export function extractRecipe(html: string, pageUrl: string): RecipeImport | null {
  const jsonLd = findRecipe(jsonLdBlocks(html));
  const candidates: [RecipeImport['found'], RecipeInput][] = [
    ...(jsonLd ? [['full', recipeFromJsonLd(jsonLd, pageUrl, html)] as ['full', RecipeInput]] : []),
    ['basic', recipeFromMeta(html, pageUrl)],
  ];
  for (const [found, draft] of candidates) {
    // The same validation as when saving, so the form can't be handed
    // something the API would refuse.
    const parsed = recipeInputSchema.safeParse(draft);
    if (!parsed.success) continue;
    const { ingredients, steps } = parsed.data;
    // Recipe data with neither ingredients nor steps is no better than a title.
    const hasContent = ingredients.length > 0 || steps.length > 0;
    return { recipe: parsed.data, found: hasContent ? found : 'basic' };
  }
  return null;
}
