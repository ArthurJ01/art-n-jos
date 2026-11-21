import { Link } from 'react-router';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { mealTypes, type MealPlanEntry } from '@art-web/shared';
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

interface Props {
  days: string[];
  today: string;
  entries: MealPlanEntry[];
  /** False for visitors who are not logged in: the plan is shown read-only. */
  canEdit: boolean;
  selected: PaletteItem | null;
  onPlaceSelected: (slot: Slot) => void;
  onMakeLeftover: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

/** The week as seven days, each with a slot for breakfast, lunch and dinner. */
export function WeekGrid({ days, today, entries, ...rest }: Props) {
  return (
    <div className="week">
      {days.map((date) => (
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
              {...rest}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

type SlotProps = Omit<Props, 'days' | 'today'> & { slot: Slot };

function MealSlot({ slot, entries, canEdit, selected, onPlaceSelected, ...actions }: SlotProps) {
  // Makes this cell a drop target. `isOver` is true while something is held over it.
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot.date}:${slot.meal}`,
    data: slot,
    disabled: !canEdit,
  });
  const label = mealLabels[slot.meal];

  return (
    <div ref={setNodeRef} className={isOver ? 'slot slot-over' : 'slot'}>
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
