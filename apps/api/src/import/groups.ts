/**
 * Finds the group headings of an ingredient list ("Sås:", "Till servering:").
 *
 * The recipe data a site publishes for programs (schema.org, see extract.ts)
 * has the ingredients as one flat list. It has no way to say that some of
 * them are for the sauce. The page itself usually does show that, as small
 * headings between the ingredients:
 *
 *   <table> ...kyckling, ingefära... </table>
 *   <h3>Butter sås:</h3>
 *   <table> ...rödlök, tomater... </table>
 *
 * So this looks for the ingredients we already know in the text of the page,
 * and takes the headings that stand between them. It goes by where things
 * are in the page, not by what any one site calls its classes, so the same
 * code works for Arla and for a recipe blog. When the ingredients can't be
 * found in the page, the list is simply left flat, as before.
 */
import { isHeadingLine, toHeadingLine } from '@art-web/shared';
import { decodeEntities } from './text.js';

/** One line of visible text in a page. */
interface PageLine {
  text: string;
  /** The words and numbers of the line, in lower case. */
  words: string[];
  /** "h3" when the line is a heading of that kind, null for ordinary text. */
  heading: string | null;
}

/** Tags that start a new line of text. Other tags (span, a, td...) stay within the line. */
const BLOCK_TAGS = new Set(
  (
    'address article aside blockquote br caption dd details div dl dt fieldset figcaption ' +
    'figure footer form header hr li main nav ol p pre section summary table tbody tfoot ' +
    'thead tr ul'
  ).split(' '),
);

/** Parts of a page with no visible text in them. */
const INVISIBLE = /<!--[\s\S]*?-->|<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi;

/** "ca 500 g Smör & olja" → ["ca", "500", "g", "smör", "olja"] */
const toWords = (text: string) => text.toLowerCase().match(/[½⅓⅔¼¾⅛⅜⅝⅞]|[\p{L}\p{Nd}]+/gu) ?? [];

/**
 * The visible text of a page as lines, roughly the way a browser would break
 * it up, remembering which lines are headings (<h1> to <h6>).
 */
export function pageLines(html: string): PageLine[] {
  const lines: PageLine[] = [];
  let text = '';
  let heading: string | null = null; // the heading tag we are inside

  const endLine = () => {
    const clean = decodeEntities(text).replace(/\s+/g, ' ').trim();
    if (clean) lines.push({ text: clean, words: toWords(clean), heading });
    text = '';
  };

  // Splitting on tags gives the tags and the text between them, in order.
  for (const part of html.replace(INVISIBLE, ' ').split(/(<[^>]*>)/)) {
    const tag = /^<(\/?)([a-z][a-z0-9]*)/i.exec(part);
    if (!tag) {
      if (!part.startsWith('<')) text += part;
      continue;
    }
    const name = tag[2]!.toLowerCase();
    if (/^h[1-6]$/.test(name)) {
      endLine();
      heading = tag[1] === '/' ? null : name;
    } else if (BLOCK_TAGS.has(name)) {
      endLine();
    } else {
      text += ' '; // "<td>Salt</td><td>½ tsk</td>" is two words, not "Salt½"
    }
  }
  endLine();
  return lines;
}

/** An ingredient can be spread over a few lines: its name in one cell, the amount in the next. */
const MAX_LINES_PER_INGREDIENT = 4;
/** How many words a line may have besides the ingredient ("Arla Köket", a price...). */
const MAX_EXTRA_WORDS = 6;
/** How far below the previous ingredient the next one is looked for. */
const LOOK_AHEAD = 40;
/** A heading longer than this is not the name of a group. */
const MAX_HEADING_LENGTH = 60;

/**
 * Where an ingredient is in the page, looking from line `from` up to line
 * `to`: the first and last of the few lines that together hold all its
 * words. Null if it isn't there.
 */
function findIngredient(ingredient: string[], lines: PageLine[], from: number, to: number) {
  if (ingredient.length === 0) return null;
  for (let first = from; first < Math.min(to, lines.length); first++) {
    const seen = new Set<string>();
    let count = 0;
    for (
      let last = first;
      last < Math.min(first + MAX_LINES_PER_INGREDIENT, lines.length);
      last++
    ) {
      const line = lines[last]!;
      if (line.heading) break; // an ingredient doesn't run across a heading
      line.words.forEach((word) => seen.add(word));
      count += line.words.length;
      // Much more text than the ingredient: a paragraph that happens to mention it.
      if (count > ingredient.length + MAX_EXTRA_WORDS) break;
      if (ingredient.every((word) => seen.has(word))) return { first, last };
    }
  }
  return null;
}

/**
 * The line each ingredient starts on (-1 if it isn't found), looking for
 * them one after the other from line `start` on.
 */
function locate(ingredients: string[][], lines: PageLine[], start: number): number[] {
  let from = start;
  return ingredients.map((ingredient) => {
    const found = findIngredient(ingredient, lines, from, from + LOOK_AHEAD);
    if (!found) return -1;
    from = found.last + 1;
    return found.first;
  });
}

/**
 * Where the ingredient list is in the page: the line of each ingredient.
 *
 * A page can mention the first ingredient in several places (a menu, a
 * shopping list, another recipe...). Each of them is tried as the start of
 * the list, and the one where the most ingredients follow is kept. If the
 * first ingredient isn't in the page as it is written in the data, the
 * second or third one is used to find the start instead.
 */
function locateList(ingredients: string[][], lines: PageLine[]): number[] {
  let best: number[] = [];
  let bestCount = 0;
  for (let anchor = 0; anchor < Math.min(3, ingredients.length) && bestCount === 0; anchor++) {
    let from = 0;
    for (let tries = 0; tries < 30; tries++) {
      const start = findIngredient(ingredients[anchor]!, lines, from, lines.length);
      if (!start) break;
      from = start.first + 1;
      const places = [
        ...ingredients.slice(0, anchor).map(() => -1),
        ...locate(ingredients.slice(anchor), lines, start.first),
      ];
      const count = places.filter((line) => line >= 0).length;
      if (count > bestCount) [best, bestCount] = [places, count];
    }
  }
  return best;
}

/**
 * `ingredients` with a heading line ("Sås:") put in front of each group the
 * page shows them in. Returns the list unchanged when it finds no groups.
 */
export function groupIngredients(ingredients: string[], html: string): string[] {
  // Too few to be in groups, or the site has put its headings in the list itself.
  if (ingredients.length < 2 || ingredients.some(isHeadingLine)) return ingredients;

  const lines = pageLines(html);
  const places = locateList(ingredients.map(toWords), lines);
  const found = places.filter((line) => line >= 0);
  // Most of the ingredients have to be there, or this isn't the ingredient list.
  if (found.length < Math.max(2, Math.ceil(ingredients.length * 0.6))) return ingredients;

  const firstLine = found[0]!;
  const lastLine = found[found.length - 1]!;
  const isGroupName = (line: PageLine) =>
    line.heading !== null && line.text.length <= MAX_HEADING_LENGTH && /\p{L}/u.test(line.text);

  // Headings between the first and the last ingredient are group headings.
  const between: number[] = [];
  for (let i = firstLine + 1; i < lastLine; i++) if (isGroupName(lines[i]!)) between.push(i);
  if (between.length === 0) return ingredients;

  // If the page mixes kinds of headings there, go with the most common kind.
  const kinds = between.map((i) => lines[i]!.heading);
  const timesUsed = (kind: string | null) => kinds.filter((k) => k === kind).length;
  const kind = [...kinds].sort((a, b) => timesUsed(b) - timesUsed(a))[0]!;
  const headings = between.filter((i) => lines[i]!.heading === kind);

  // The first group may have a heading too, just above the first ingredient.
  // (But not the "Ingredienser" title of the whole list.)
  for (let i = firstLine - 1; i >= Math.max(0, firstLine - 3); i--) {
    const line = lines[i]!;
    if (line.heading === kind && isGroupName(line) && !/^ingredien/i.test(line.text)) {
      headings.unshift(i);
      break;
    }
  }

  // Each heading goes in front of the first ingredient found below it. If two
  // headings end up at the same ingredient, the one nearest to it is kept.
  const headingAt = new Map<number, string>();
  for (const i of headings) {
    const next = places.findIndex((line) => line > i);
    if (next >= 0) headingAt.set(next, lines[i]!.text);
  }
  return ingredients.flatMap((ingredient, index) => {
    const heading = headingAt.get(index);
    return heading ? [toHeadingLine(heading), ingredient] : [ingredient];
  });
}
