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

/** The recipes whose title contains the search text, as palette items. */
export function recipeItems(recipes: Recipe[] | undefined, search: string): PaletteItem[] {
  const needle = search.trim().toLowerCase();
  return (recipes ?? [])
    .filter((r) => r.title.toLowerCase().includes(needle))
    .map((r) => ({ kind: 'recipe', recipeId: r.id, title: r.title }));
}

/**
 * Whatever is typed can also be planned as a meal of its own, without a
 * recipe ("Tacos hos mamma"). Null when nothing is typed, or when a recipe
 * already has exactly that name.
 */
export function customItem(search: string, recipes: PaletteItem[]): PaletteItem | null {
  const title = search.trim().replace(/\s+/g, ' ').slice(0, 100);
  if (!title) return null;
  const lower = title.toLowerCase();
  return recipes.some((r) => r.title.toLowerCase() === lower) ? null : { kind: 'custom', title };
}

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
