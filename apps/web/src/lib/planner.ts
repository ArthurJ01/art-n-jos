/** Types and labels shared by the meal planner components. */
import type { MealPlanEntry, MealType, Recipe } from '@art-web/shared';

export const mealLabels: Record<MealType, string> = {
  breakfast: 'Frukost',
  lunch: 'Lunch',
  dinner: 'Middag',
};

export const EAT_OUT_LABEL = 'Äta ute';
export const LEFTOVER_LABEL = 'Matlåda';
export const CUSTOM_LABEL = 'Egen måltid';

/** Something in the list on the left that can be put into the calendar. */
export type PaletteItem =
  | { kind: 'recipe'; recipeId: number; title: string }
  | { kind: 'eat_out'; title: string }
  /** A meal without a recipe, named by typing in the search box. */
  | { kind: 'custom'; title: string };

export const eatOutItem: PaletteItem = { kind: 'eat_out', title: EAT_OUT_LABEL };

/** "  Tacos   hos mamma " → "Tacos hos mamma", cut to what the API accepts. */
export const cleanTitle = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 100);

/**
 * The recipes whose title contains the search text, as palette items. A
 * recipe with exactly that name comes first, so it is the one Enter picks
 * ("Lasagne" before "Vegetarisk lasagne").
 */
export function recipeItems(recipes: Recipe[] | undefined, search: string): PaletteItem[] {
  const needle = search.trim().toLowerCase();
  const isExact = (item: PaletteItem) => item.title.trim().toLowerCase() === needle;
  return (recipes ?? [])
    .filter((r) => r.title.toLowerCase().includes(needle))
    .map((r): PaletteItem => ({ kind: 'recipe', recipeId: r.id, title: r.title }))
    .sort((a, b) => Number(isExact(b)) - Number(isExact(a)));
}

/**
 * Whatever is typed can also be planned as a meal of its own, without a
 * recipe ("Tacos hos mamma"). Null when nothing is typed, or when a recipe
 * already has exactly that name.
 */
export function customItem(search: string, recipes: PaletteItem[]): PaletteItem | null {
  const title = cleanTitle(search);
  if (!title) return null;
  const lower = title.toLowerCase();
  // "Äta ute" typed out is the eat-out item, not a meal of its own with that name.
  if (lower === EAT_OUT_LABEL.toLowerCase()) return null;
  return recipes.some((r) => r.title.toLowerCase() === lower) ? null : { kind: 'custom', title };
}

/**
 * What a typed text means when it is saved as it stands (clicking outside the
 * search box): the recipe with exactly that name, "Äta ute", or else a meal of
 * its own. Null when nothing is typed.
 *
 * Unlike Enter, this never picks a recipe that merely contains the text:
 * typing "Tacos" and clicking away should not plan "Fisktacos".
 */
export function typedItem(search: string, recipes: Recipe[] | undefined): PaletteItem | null {
  const title = cleanTitle(search);
  if (!title) return null;
  const lower = title.toLowerCase();
  const recipe = (recipes ?? []).find((r) => r.title.trim().toLowerCase() === lower);
  if (recipe) return { kind: 'recipe', recipeId: recipe.id, title: recipe.title };
  if (lower === EAT_OUT_LABEL.toLowerCase()) return eatOutItem;
  return { kind: 'custom', title };
}

/** True when two items would plan the same thing (same recipe, or the same typed name). */
export const isSameItem = (a: PaletteItem, b: PaletteItem) => paletteItemId(a) === paletteItemId(b);

/** A stable id for a palette item (used as React key and drag id). */
export function paletteItemId(item: PaletteItem): string {
  if (item.kind === 'recipe') return `recipe:${item.recipeId}`;
  if (item.kind === 'custom') return `custom:${item.title}`;
  return 'eat_out';
}

/** One cell in the calendar: a meal on a day. */
export interface Slot {
  date: string;
  meal: MealType;
}

/** The fields of a new entry that depend on what kind of item it is. */
export function itemFields(item: PaletteItem) {
  if (item.kind === 'recipe') return { kind: item.kind, recipeId: item.recipeId };
  if (item.kind === 'custom') return { kind: item.kind, title: item.title };
  return { kind: item.kind };
}

/** The palette item an entry was made from, e.g. to plan it again as a lunch box. */
export function entryItem(entry: MealPlanEntry): PaletteItem {
  if (entry.kind === 'recipe' && entry.recipeId != null) {
    return { kind: 'recipe', recipeId: entry.recipeId, title: entryTitle(entry) };
  }
  if (entry.kind === 'custom') return { kind: 'custom', title: entryTitle(entry) };
  return { kind: 'eat_out', title: EAT_OUT_LABEL };
}

/**
 * What is being dragged. dnd-kit lets us attach any data to a draggable; this
 * type tells the drop handler whether to create a new entry or move one.
 */
export type DragData = { type: 'new'; item: PaletteItem } | { type: 'entry'; entry: MealPlanEntry };

export function entryTitle(entry: MealPlanEntry): string {
  if (entry.kind === 'eat_out') return EAT_OUT_LABEL;
  if (entry.kind === 'custom') return entry.title ?? CUSTOM_LABEL;
  return entry.recipeTitle ?? 'Okänt recept';
}

export const dragTitle = (data: DragData) =>
  data.type === 'new' ? data.item.title : entryTitle(data.entry);
