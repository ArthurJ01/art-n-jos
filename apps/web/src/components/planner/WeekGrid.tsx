import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { mealTypes, type MealPlanEntry, type Recipe } from '@art-web/shared';
import { isSavedEntry } from '../../lib/api';
import { formatDayMonth, formatWeekday } from '../../lib/dates';
import { paths } from '../../lib/paths';
import {
  entryTitle,
  LEFTOVER_LABEL,
  mealLabels,
  type DragData,
  type PaletteItem,
  type Slot,
} from '../../lib/planner';
import { SlotQuickAdd } from './SlotQuickAdd';

interface Props {
  days: string[];
  today: string;
  entries: MealPlanEntry[];
  /** False for visitors who are not logged in: the plan is shown read-only. */
  canEdit: boolean;
  selected: PaletteItem | null;
  onPlaceSelected: (slot: Slot) => void;
  /** For the search box that a double-click on a slot opens. */
  recipes: Recipe[] | undefined;
  onAdd: (item: PaletteItem, slot: Slot) => void;
  onMakeLeftover: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

/** The week as seven days, each with a slot for breakfast, lunch and dinner. */
export function WeekGrid({ days, today, entries, ...rest }: Props) {
  // Which slot has its search box open ("2026-11-18:dinner"). Only one at a time.
  const [quickAdd, setQuickAdd] = useState<string | null>(null);

  return (
    <div className="week">
      {days.map((date, dayIndex) => (
        <section
          key={date}
          className={date === today ? 'day day-today' : 'day'}
          aria-label={`${formatWeekday(date)} ${formatDayMonth(date)}`}
        >
          <header className="day-head">
            <span className="day-name">{formatWeekday(date)}</span>
            <span className="day-date">{formatDayMonth(date)}</span>
          </header>
          {mealTypes.map((meal) => (
            <MealSlot
              key={meal}
              slot={{ date, meal }}
              entries={entries.filter((e) => e.date === date && e.meal === meal)}
              // The last days are near the right edge, so their popup opens leftwards.
              alignEnd={dayIndex >= days.length - 2}
              quickAddOpen={quickAdd === `${date}:${meal}`}
              onQuickAdd={(open) => setQuickAdd(open ? `${date}:${meal}` : null)}
              {...rest}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

type SlotProps = Omit<Props, 'days' | 'today'> & {
  slot: Slot;
  alignEnd: boolean;
  quickAddOpen: boolean;
  onQuickAdd: (open: boolean) => void;
};

function MealSlot({
  slot,
  entries,
  canEdit,
  selected,
  onPlaceSelected,
  recipes,
  onAdd,
  alignEnd,
  quickAddOpen,
  onQuickAdd,
  ...actions
}: SlotProps) {
  // Makes this cell a drop target. `isOver` is true while something is held over it.
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot.date}:${slot.meal}`,
    data: slot,
    disabled: !canEdit,
  });
  const label = mealLabels[slot.meal];

  // Double-clicks on an entry or a button belong to them, not to the slot.
  const isOwnClick = (e: MouseEvent) =>
    !(e.target as Element).closest('.entry, .slot-add, .quick-add');

  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'slot slot-over' : 'slot'}
      onMouseDown={(e) => {
        // The second click of a double-click would otherwise select the
        // "Middag" label as text.
        if (canEdit && e.detail > 1 && isOwnClick(e)) e.preventDefault();
      }}
      onDoubleClick={(e) => {
        if (canEdit && isOwnClick(e)) onQuickAdd(true);
      }}
    >
      <span className="slot-label">{label}</span>
      {entries.map((entry) => (
        <EntryChip key={entry.id} entry={entry} canEdit={canEdit} {...actions} />
      ))}
      {selected && (
        <button
          type="button"
          className="slot-add"
          aria-label={`Lägg till ${selected.title}: ${formatWeekday(slot.date)} ${label.toLowerCase()}`}
          onClick={() => onPlaceSelected(slot)}
        >
          +
        </button>
      )}
      {canEdit && quickAddOpen && (
        <SlotQuickAdd
          label={`${formatWeekday(slot.date)} ${label.toLowerCase()}`}
          recipes={recipes}
          alignEnd={alignEnd}
          onPick={(item) => {
            onAdd(item, slot);
            onQuickAdd(false);
          }}
          onClose={() => onQuickAdd(false)}
        />
      )}
    </div>
  );
}

interface ChipProps {
  entry: MealPlanEntry;
  canEdit: boolean;
  onMakeLeftover: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

function EntryChip({ entry, canEdit, onMakeLeftover, onRemove }: ChipProps) {
  const data: DragData = { type: 'entry', entry };
  // An entry that is still being saved has no real id yet, so it can't be moved.
  const editable = canEdit && isSavedEntry(entry);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    data,
    disabled: !editable,
    attributes: { roleDescription: 'dragbar' },
  });
  const title = entryTitle(entry);

  const classes = ['chip', 'entry'];
  if (entry.kind === 'eat_out') classes.push('chip-eat-out');
  if (entry.kind === 'custom') classes.push('chip-custom');
  if (entry.isLeftover) classes.push('chip-leftover');
  if (editable) classes.push('entry-editable');
  if (isDragging) classes.push('entry-dragging');

  return (
    <div
      ref={setNodeRef}
      className={classes.join(' ')}
      {...(editable ? listeners : {})}
      {...(editable ? attributes : {})}
    >
      <span className="entry-text">
        {entry.isLeftover && <span className="entry-badge">{LEFTOVER_LABEL}</span>}
        {entry.recipeId ? (
          // draggable={false}: otherwise the browser starts its own link drag.
          <Link to={paths.recipe(entry.recipeId)} draggable={false}>
            {title}
          </Link>
        ) : (
          title
        )}
      </span>
      {editable && (
        <span className="entry-actions">
          {entry.kind !== 'eat_out' && !entry.isLeftover && (
            <button
              type="button"
              className="entry-action"
              title="Matlåda till lunch dagen efter"
              aria-label={`Gör matlåda av ${title} till lunch dagen efter`}
              onClick={() => onMakeLeftover(entry)}
            >
              🍱
            </button>
          )}
          <button
            type="button"
            className="entry-action"
            title="Ta bort"
            aria-label={`Ta bort ${title}`}
            onClick={() => onRemove(entry)}
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}
