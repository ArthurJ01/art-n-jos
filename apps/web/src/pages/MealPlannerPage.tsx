import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { MealPlanEntry } from '@art-web/shared';
import {
  useAddMealPlanEntry,
  useDeleteMealPlanEntry,
  useMe,
  useMealPlan,
  useMoveMealPlanEntry,
  useRecipes,
} from '../lib/api';
import {
  addDays,
  formatDayMonth,
  formatWeekday,
  isIsoDate,
  isoWeekNumber,
  startOfWeek,
  todayIso,
  weekDays,
} from '../lib/dates';
import { paths } from '../lib/paths';
import {
  dragTitle,
  entryItem,
  itemFields,
  mealLabels,
  type DragData,
  type PaletteItem,
  type Slot,
} from '../lib/planner';
import { RecipePalette } from '../components/planner/RecipePalette';
import { WeekGrid } from '../components/planner/WeekGrid';

const WEEK_PARAM = 'vecka';

/** "måndag middag", for screen reader announcements. */
const describeSlot = (slot: Slot) =>
  `${formatWeekday(slot.date)} ${mealLabels[slot.meal].toLowerCase()}`;

// dnd-kit reads these out to screen reader users while they drag with the keyboard.
const announcements: Announcements = {
  onDragStart: ({ active }) => `Lyfte ${dragTitle(active.data.current as DragData)}.`,
  onDragOver: ({ over }) => (over ? `Över ${describeSlot(over.data.current as Slot)}.` : undefined),
  onDragEnd: ({ active, over }) =>
    over
      ? `Släppte ${dragTitle(active.data.current as DragData)} på ${describeSlot(over.data.current as Slot)}.`
      : 'Släppte utanför kalendern. Inget ändrades.',
  onDragCancel: () => 'Avbröt. Inget ändrades.',
};
const screenReaderInstructions = {
  draggable:
    'Tryck på mellanslag för att lyfta. Flytta med piltangenterna, släpp med mellanslag och avbryt med Escape.',
};

export function MealPlannerPage() {
  // The week lives in the URL (?vecka=2026-11-16) so it survives a reload
  // and a link to a certain week can be shared.
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const today = todayIso();
  const weekParam = params.get(WEEK_PARAM) ?? '';
  const monday = startOfWeek(isIsoDate(weekParam) ? weekParam : today);
  const days = weekDays(monday);
  const sunday = days[6]!;
  const isCurrentWeek = monday === startOfWeek(today);

  const goToWeek = (date: string) => {
    const target = startOfWeek(date);
    setParams(target === startOfWeek(today) ? {} : { [WEEK_PARAM]: target });
  };

  const { data: me } = useMe();
  const canEdit = me?.authenticated ?? false;
  const plan = useMealPlan(monday, sunday);
  const recipes = useRecipes({});
  const add = useAddMealPlanEntry();
  const move = useMoveMealPlanEntry();
  const remove = useDeleteMealPlanEntry();
  const saveError = add.error ?? move.error ?? remove.error;

  /** Picked by clicking in the list; the next click on a slot places it. */
  const [selected, setSelected] = useState<PaletteItem | null>(null);
  /** What is being dragged right now, to draw it under the pointer. */
  const [dragging, setDragging] = useState<DragData | null>(null);

  const sensors = useSensors(
    // Only start dragging after the mouse has moved a little, so that plain
    // clicks on links and buttons inside a draggable still work.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On touch screens: press and hold to drag, so swiping still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const addItem = (item: PaletteItem, slot: Slot, isLeftover = false) =>
    add.mutate({
      input: { ...slot, ...itemFields(item), isLeftover },
      recipeTitle: item.kind === 'recipe' ? item.title : null,
    });

  const onDragStart = (event: DragStartEvent) => {
    setDragging(event.active.data.current as DragData);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const data = event.active.data.current as DragData;
    const slot = event.over?.data.current as Slot | undefined;
    if (!slot) return; // dropped outside the calendar

    if (data.type === 'new') {
      addItem(data.item, slot);
    } else if (data.entry.date !== slot.date || data.entry.meal !== slot.meal) {
      move.mutate({ id: data.entry.id, date: slot.date, meal: slot.meal });
    }
  };

  /** A lunch box: the same meal again, for lunch the day after. */
  const onMakeLeftover = (entry: MealPlanEntry) => {
    if (entry.kind === 'eat_out') return;
    const date = addDays(entry.date, 1);
    addItem(entryItem(entry), { date, meal: 'lunch' }, true);
    // Sunday's lunch box lands on next week's Monday: go there so it is visible.
    if (date > sunday) goToWeek(date);
  };

  return (
    <>
      <div className="planner-head">
        <h1>Matplanering</h1>
        <div className="week-nav">
          <button
            type="button"
            className="button"
            aria-label="Föregående vecka"
            onClick={() => goToWeek(addDays(monday, -7))}
          >
            ←
          </button>
          <span className="week-label">
            <strong>Vecka {isoWeekNumber(monday)}</strong>
            <span className="muted">
              {formatDayMonth(monday)} – {formatDayMonth(sunday)}
            </span>
          </span>
          <button
            type="button"
            className="button"
            aria-label="Nästa vecka"
            onClick={() => goToWeek(addDays(monday, 7))}
          >
            →
          </button>
          {!isCurrentWeek && (
            <button type="button" className="button button-ghost" onClick={() => goToWeek(today)}>
              Idag
            </button>
          )}
        </div>
      </div>

      {me && !canEdit && (
        <p className="muted">
          <Link to={paths.login} state={{ from: location.pathname + location.search }}>
            Logga in
          </Link>{' '}
          för att ändra planeringen.
        </p>
      )}
      {plan.error && <p className="error">Kunde inte hämta planeringen: {plan.error.message}</p>}
      {saveError && <p className="error">Kunde inte spara ändringen: {saveError.message}</p>}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        <div className={canEdit ? 'planner' : 'planner planner-readonly'}>
          {canEdit && (
            <RecipePalette
              recipes={recipes.data}
              isPending={recipes.isPending}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          <WeekGrid
            days={days}
            today={today}
            entries={plan.data ?? []}
            canEdit={canEdit}
            selected={canEdit ? selected : null}
            onPlaceSelected={(slot) => selected && addItem(selected, slot)}
            recipes={recipes.data}
            onAdd={(item, slot) => addItem(item, slot)}
            onMakeLeftover={onMakeLeftover}
            onRemove={(entry) => remove.mutate(entry.id)}
          />
        </div>
        {/* A copy of the dragged item that follows the pointer. */}
        <DragOverlay dropAnimation={null}>
          {dragging && <div className="chip chip-overlay">{dragTitle(dragging)}</div>}
        </DragOverlay>
      </DndContext>
    </>
  );
}
