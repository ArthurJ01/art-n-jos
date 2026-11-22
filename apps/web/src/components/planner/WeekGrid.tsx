import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { mealTypes, type MealPlanEntry, type Recipe } from '@art-web/shared';
import { isSavedEntry } from '../../lib/api';
import { formatDayMonth, formatWeekday } from '../../lib/dates';
import { useLongPress } from '../../lib/useLongPress';
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

/**
 * How long a click on a recipe waits before it opens the recipe, in case a
 * second click turns it into a double-click (which changes the meal instead).
 */
const DOUBLE_CLICK_MS = 300;

interface Props {
  days: string[];
  today: string;
  entries: MealPlanEntry[];
  /** False for visitors who are not logged in: the plan is shown read-only. */
  canEdit: boolean;
  selected: PaletteItem | null;
  onPlaceSelected: (slot: Slot) => void;
  /** For the search box that a double-click opens. */
  recipes: Recipe[] | undefined;
  onAdd: (item: PaletteItem, slot: Slot) => void;
  /** Swap a planned meal for something else (picked in the search box). */
  onReplace: (entry: MealPlanEntry, item: PaletteItem) => void;
  onMakeLeftover: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

/** The search box that is open, if any. Only one at a time. */
interface OpenSearch {
  /** Which slot it is in: "2026-11-18:dinner". */
  slot: string;
  /** Set when it changes a planned meal instead of adding one. */
  entryId?: number;
  /**
   * Opened by press-and-hold: the text box is then focused when the finger
   * lifts instead of right away (see onTouchEnd in MealSlot).
   */
  byTouch: boolean;
}

/** The week as seven days, each with a slot for breakfast, lunch and dinner. */
export function WeekGrid({ days, today, entries, ...rest }: Props) {
  const [search, setSearch] = useState<OpenSearch | null>(null);

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
          {mealTypes.map((meal) => {
            const key = `${date}:${meal}`;
            return (
              <MealSlot
                key={meal}
                slot={{ date, meal }}
                entries={entries.filter((e) => e.date === date && e.meal === meal)}
                // The last days are near the right edge, so their popup opens leftwards.
                alignEnd={dayIndex >= days.length - 2}
                search={search?.slot === key ? search : null}
                onSearch={(open) => setSearch(open && { ...open, slot: key })}
                {...rest}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}

type SlotProps = Omit<Props, 'days' | 'today'> & {
  slot: Slot;
  alignEnd: boolean;
  /** The search box, when it is open in this slot. */
  search: OpenSearch | null;
  /** Opens the search box in this slot, or closes it (null). */
  onSearch: (open: Omit<OpenSearch, 'slot'> | null) => void;
};

function MealSlot({
  slot,
  entries,
  canEdit,
  selected,
  onPlaceSelected,
  recipes,
  onAdd,
  onReplace,
  alignEnd,
  search,
  onSearch,
  ...actions
}: SlotProps) {
  // Makes this cell a drop target. `isOver` is true while something is held over it.
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${slot.date}:${slot.meal}`,
    data: slot,
    disabled: !canEdit,
  });
  const label = mealLabels[slot.meal];
  const slotLabel = `${formatWeekday(slot.date)} ${label.toLowerCase()}`;

  const slotRef = useRef<HTMLDivElement | null>(null);

  // Clicks and touches on an entry or a button belong to them, not to the slot.
  // (Holding an entry drags it, double-clicking it changes it.)
  const isOwnClick = (e: MouseEvent) =>
    !(e.target as Element).closest('.entry, .slot-add, .quick-add');

  // On phones, press and hold instead of double-click.
  const longPress = useLongPress({
    shouldStart: (e) => canEdit && isOwnClick(e),
    onLongPress: () => {
      onSearch({ byTouch: true });
      // A short buzz where supported (Android), like a native long-press.
      navigator.vibrate?.(10);
    },
  });

  // The meal the search box is changing. If it has gone (removed in another
  // tab, say) there is nothing to change, and the box is not shown.
  const editing =
    search?.entryId === undefined ? null : entries.find((e) => e.id === search.entryId);
  const showSearch = canEdit && search !== null && editing !== undefined;

  const classes = ['slot'];
  if (canEdit) classes.push('slot-editable');
  if (isOver) classes.push('slot-over');

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        slotRef.current = node;
      }}
      className={classes.join(' ')}
      onMouseDown={(e) => {
        // The second click of a double-click would otherwise select the
        // "Middag" label as text.
        if (canEdit && e.detail > 1 && isOwnClick(e)) e.preventDefault();
      }}
      onDoubleClick={(e) => {
        if (canEdit && isOwnClick(e)) onSearch({ byTouch: false });
      }}
      {...longPress.handlers}
      onTouchEnd={(e) => {
        if (!longPress.takeLongPress()) return;
        // Phones only open the keyboard for focus() during a touch, so focus
        // the search box now, as the finger lifts. preventDefault stops the
        // browser from turning the touch into a click afterwards.
        e.preventDefault();
        slotRef.current?.querySelector<HTMLInputElement>('.quick-add-input')?.focus();
      }}
    >
      <span className="slot-label">{label}</span>
      {entries.map((entry) => (
        <EntryChip
          key={entry.id}
          entry={entry}
          canEdit={canEdit}
          isEditing={showSearch && editing?.id === entry.id}
          onEdit={() => onSearch({ entryId: entry.id, byTouch: false })}
          {...actions}
        />
      ))}
      {selected && (
        <button
          type="button"
          className="slot-add"
          aria-label={`Lägg till ${selected.title}: ${slotLabel}`}
          onClick={() => onPlaceSelected(slot)}
        >
          +
        </button>
      )}
      {showSearch && (
        <SlotQuickAdd
          // A fresh box (and a fresh text) when it moves on to another meal.
          key={editing?.id ?? 'new'}
          label={slotLabel}
          recipes={recipes}
          editing={editing ? entryTitle(editing) : undefined}
          alignEnd={alignEnd}
          autoFocus={!search.byTouch}
          onPick={(item) => {
            if (editing) onReplace(editing, item);
            else onAdd(item, slot);
            onSearch(null);
          }}
          onClose={() => onSearch(null)}
        />
      )}
    </div>
  );
}

interface ChipProps {
  entry: MealPlanEntry;
  canEdit: boolean;
  /** The search box is open on this meal. */
  isEditing: boolean;
  onEdit: () => void;
  onMakeLeftover: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

function EntryChip({ entry, canEdit, isEditing, onEdit, onMakeLeftover, onRemove }: ChipProps) {
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
  const openRecipe = useDelayedRecipeLink(entry.recipeId, editable);

  const classes = ['chip', 'entry'];
  if (entry.kind === 'eat_out') classes.push('chip-eat-out');
  if (entry.kind === 'custom') classes.push('chip-custom');
  if (entry.isLeftover) classes.push('chip-leftover');
  if (editable) classes.push('entry-editable');
  if (isDragging) classes.push('entry-dragging');
  if (isEditing) classes.push('chip-selected');

  return (
    <div
      ref={setNodeRef}
      className={classes.join(' ')}
      {...(editable ? listeners : {})}
      {...(editable ? attributes : {})}
      onPointerDown={openRecipe.onPointerDown}
      onDoubleClick={(e) => {
        // Not on the buttons: two quick clicks there are two clicks.
        if (editable && !(e.target as Element).closest('.entry-actions')) onEdit();
      }}
    >
      <span className="entry-text">
        {entry.isLeftover && <span className="entry-badge">{LEFTOVER_LABEL}</span>}
        {/* `title` is the browser's own tooltip: a name cut short after three
            lines (see styles.css) can be read in full by pointing at it. */}
        <span className="entry-name" title={title}>
          {entry.recipeId ? (
            // draggable={false}: otherwise the browser starts its own link drag.
            <Link to={paths.recipe(entry.recipeId)} draggable={false} onClick={openRecipe.onClick}>
              {title}
            </Link>
          ) : (
            title
          )}
        </span>
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
          {/* The same as a double-click on the meal, for touch screens, the
              keyboard, and anyone who doesn't think of double-clicking. */}
          <button
            type="button"
            className="entry-action entry-action-edit"
            title="Ändra"
            aria-label={`Ändra ${title}`}
            onClick={onEdit}
          >
            ✎
          </button>
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

/**
 * Lets a recipe's name in the calendar be both a link (one click opens the
 * recipe) and something to double-click (which changes the meal).
 *
 * A browser can't know that a click is the first half of a double-click, so
 * the link waits a moment before it opens. Only plain mouse clicks wait:
 * ctrl-click and middle-click (new tab), the keyboard and taps on a touch
 * screen (which have a button for changing the meal instead) open at once.
 */
function useDelayedRecipeLink(recipeId: number | null, enabled: boolean) {
  const navigate = useNavigate();
  const timer = useRef<number | undefined>(undefined);
  // Click events don't say in every browser what made them, pointer events do.
  const pointerType = useRef('');

  // Don't open the recipe after the meal has gone from the calendar.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    onPointerDown: (e: { pointerType: string }) => {
      pointerType.current = e.pointerType;
    },
    onClick: (e: MouseEvent) => {
      const plainMouseClick =
        pointerType.current === 'mouse' &&
        e.detail > 0 && // 0 is a "click" made with the Enter key
        e.button === 0 &&
        !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey);
      if (!enabled || recipeId === null || !plainMouseClick) return;

      e.preventDefault();
      window.clearTimeout(timer.current);
      // detail is 1 for a first click and 2 for the second of a double-click,
      // which opens the search box instead (onDoubleClick on the chip).
      if (e.detail === 1) {
        timer.current = window.setTimeout(() => navigate(paths.recipe(recipeId)), DOUBLE_CLICK_MS);
      }
    },
  };
}
