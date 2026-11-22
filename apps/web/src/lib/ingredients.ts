/**
 * Reading the amount out of an ingredient line, and recalculating it for
 * another number of portions.
 *
 * Ingredients are stored the way they are typed ("ca 500 g kycklingfilé").
 * The split into amount and name happens here, when a recipe is shown, so a
 * line this code can't read is simply shown as it is and nothing is lost.
 */

const FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const GLYPHS = Object.keys(FRACTIONS).join('');

// One number the way recipes write them: 2, 1,5, ½, 1 ½, 1/2 or 1 1/2.
// "1/2" has to be tried first, or the "1" alone would count as the number.
const NUMBER = `(?:\\d+/\\d+|\\d+(?:[.,]\\d+)?(?:\\s?[${GLYPHS}]|\\s\\d+/\\d+)?|[${GLYPHS}])`;

// "ca 2–3 dl grädde": an optional "about", a number or a range, then the rest.
const LINE = new RegExp(
  `^(?<prefix>(?:ca\\.?|cirka|ungefär|about|approx\\.?|~)\\s*)?` +
    `(?<min>${NUMBER})(?:\\s*[-–—]\\s*(?<max>${NUMBER}))?\\s*(?<rest>.*)$`,
  'i',
);

/**
 * Words that belong to the amount ("2 dl", "1 burk") instead of the name.
 * Anything else after the number is the ingredient itself ("4 vitlöksklyftor").
 */
const UNITS = new Set(
  [
    // Swedish
    'g gram kg kilo hg mg l liter dl cl ml msk tsk krm st cm',
    'förp förpackning förpackningar paket pkt burk burkar påse påsar ask tub flaska',
    'klyfta klyftor kruka krukor knippe knippa näve nävar nypa nypor skiva skivor',
    'bit bitar kvist kvistar blad stjälk stjälkar tärning tärningar kopp koppar',
    // English
    'cup cups tbsp tbs tablespoon tablespoons tsp teaspoon teaspoons oz ounce ounces',
    'lb lbs pound pounds pinch clove cloves can cans slice slices piece pieces',
    'stick sticks bunch sprig sprigs quart pint inch',
  ]
    .join(' ')
    .split(' '),
);

export interface Ingredient {
  /** The amount as it was written, unit included: "ca 500 g". Empty when the line has none. */
  amount: string;
  /** What is left: "strimlad kycklingbröstfilé". */
  name: string;
  /** The amount as numbers, for recalculating. Null when there is nothing to recalculate. */
  quantity: { prefix: string; min: number; max: number | null; unit: string } | null;
}

/** "1 ½" → 1.5, "1,5" → 1.5, "3/4" → 0.75 */
function toNumber(text: string): number {
  return text
    .trim()
    .split(/\s+|(?=[^\d.,/])/) // "1½" and "1 ½" both become ["1", "½"]
    .filter(Boolean)
    .reduce((sum, part) => {
      if (part in FRACTIONS) return sum + FRACTIONS[part]!;
      const [top, bottom] = part.split('/');
      if (bottom) return sum + Number(top) / Number(bottom);
      return sum + Number(part.replace(',', '.'));
    }, 0);
}

export function parseIngredient(line: string): Ingredient {
  const text = line.trim();
  const unparsed: Ingredient = { amount: '', name: text, quantity: null };

  const groups = LINE.exec(text)?.groups;
  if (!groups) return unparsed;
  const rest = groups.rest ?? '';

  // The first word after the number is a unit if it is one we know ("msk.", "dl").
  const firstWord = /^[\p{L}]+\.?(?=\s|$)/u.exec(rest)?.[0] ?? '';
  const unit = UNITS.has(firstWord.replace('.', '').toLowerCase()) ? firstWord : '';
  const name = rest.slice(unit.length).trim();

  // "5-kryddor" or a lone "2 dl": the number wasn't the amount of something.
  // "2 msk + 1 tsk socker": two amounts, and only the first could be recalculated.
  if (!name || /^[-–—/:+]/.test(name)) return unparsed;

  const min = toNumber(groups.min!);
  const max = groups.max ? toNumber(groups.max) : null;
  if (!Number.isFinite(min) || (max !== null && !Number.isFinite(max))) return unparsed;

  return {
    amount: text.slice(0, text.length - name.length).trim(),
    name,
    quantity: { prefix: (groups.prefix ?? '').trim(), min, max, unit },
  };
}

/**
 * True for a line with a number in it that `parseIngredient` could not read
 * as an amount ("Saften av 1 lime"). When the recipe is recalculated, such a
 * line stays as it is, which the page should say.
 */
export const hasUnreadAmount = (line: string, ingredient: Ingredient) =>
  ingredient.quantity === null && ANY_NUMBER.test(line);

const ANY_NUMBER = new RegExp(`[\\d${GLYPHS}]`);

/** The parts of a whole that are easy to measure in a kitchen. */
const KITCHEN_PARTS: [number, string][] = [
  [0, ''],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [1, ''],
];

/**
 * A recalculated number, rounded to something you can measure:
 * 187.5 → "190", 12.4 → "12", 1.5 → "1 ½", 0.375 → "⅓".
 */
export function formatQuantity(value: number): string {
  if (value >= 100) return String(Math.round(value / 5) * 5);
  if (value >= 10) return String(Math.round(value));
  // Less than an eighth: too little for a fraction, so show it as a decimal.
  if (value < 0.09) return value.toLocaleString('sv-SE', { maximumSignificantDigits: 1 });
  if (value < 0.19) return '⅛';

  const whole = Math.floor(value);
  const part = value - whole;
  const [nearest, glyph] = KITCHEN_PARTS.reduce((best, candidate) =>
    Math.abs(candidate[0] - part) < Math.abs(best[0] - part) ? candidate : best,
  );
  if (nearest === 1) return String(whole + 1);
  if (whole === 0) return glyph;
  return glyph ? `${whole} ${glyph}` : String(whole);
}

/**
 * The amount of an ingredient for `factor` times the recipe ("ca 500 g" × 1.5
 * → "ca 750 g"). At factor 1 it is the text exactly as it was written.
 */
export function scaledAmount(ingredient: Ingredient, factor: number): string {
  const { quantity } = ingredient;
  if (!quantity || factor === 1) return ingredient.amount;
  const min = formatQuantity(quantity.min * factor);
  const max = quantity.max === null ? null : formatQuantity(quantity.max * factor);
  const number = max && max !== min ? `${min}–${max}` : min;
  return [quantity.prefix, number, quantity.unit].filter(Boolean).join(' ');
}
