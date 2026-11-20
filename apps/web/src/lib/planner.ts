/** Types and labels shared by the meal planner components. */
import type { MealPlanEntry, MealType } from '@art-web/shared';

export const mealLabels: Record<MealType, string> = {
  breakfast: 'Frukost',
  lunch: 'Lunch',
  dinner: 'Middag',
};

export const EAT_OUT_LABEL = 'Äta ute';
export const LEFTOVER_LABEL = 'Matlåda';

/** Something in the list on the left that can be put into the calendar. */
export type PaletteItem =
  { kind: 'recipe'; recipeId: number; title: string } | { kind: 'eat_out'; title: string };

export const eatOutItem: PaletteItem = { kind: 'eat_out', title: EAT_OUT_LABEL };

/** A stable id for a palette item (used as React key and drag id). */
export const paletteItemId = (item: PaletteItem) =>
  item.kind === 'recipe' ? `recipe:${item.recipeId}` : 'eat_out';

/** One cell in the calendar: a meal on a day. */
export interface Slot {
  date: string;
  meal: MealType;
}

/**
 * What is being dragged. dnd-kit lets us attach any data to a draggable; this
 * type tells the drop handler whether to create a new entry or move one.
 */
export type DragData = { type: 'new'; item: PaletteItem } | { type: 'entry'; entry: MealPlanEntry };

export function entryTitle(entry: MealPlanEntry): string {
  if (entry.kind === 'eat_out') return EAT_OUT_LABEL;
  return entry.recipeTitle ?? 'Okänt recept';
}

export const dragTitle = (data: DragData) =>
  data.type === 'new' ? data.item.title : entryTitle(data.entry);
