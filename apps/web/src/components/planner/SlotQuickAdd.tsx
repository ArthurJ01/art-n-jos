import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Recipe } from '@art-web/shared';
import {
  cleanTitle,
  customItem,
  EAT_OUT_LABEL,
  eatOutItem,
  paletteItemId,
  recipeItems,
  typedItem,
  type PaletteItem,
} from '../../lib/planner';
import { PaletteItemLabel } from './PaletteItemLabel';

/** Enough to pick from without the popup growing taller than the slots around it. */
const MAX_RECIPES = 6;

interface Props {
  /** "onsdag middag", for the screen reader label. */
  label: string;
  recipes: Recipe[] | undefined;
  /**
   * Set when a planned meal is being changed: its current name. The box
   * starts with that name in it, selected, so typing replaces it.
   */
  editing?: string;
  /** Open towards the left, for the last days of the week. */
  alignEnd: boolean;
  /** Focus the text box as soon as it opens. Off when the slot focuses it itself (touch). */
  autoFocus?: boolean;
  onPick: (item: PaletteItem) => void;
  onClose: () => void;
}

/**
 * A small search box that opens inside a slot: on a double-click on the slot
 * to add a meal there, or on a meal to change it.
 *
 * It follows the ARIA "combobox" pattern: focus stays in the text box while
 * the arrow keys move a highlight through the list (aria-activedescendant).
 */
export function SlotQuickAdd({
  label,
  recipes,
  editing,
  alignEnd,
  autoFocus = true,
  onPick,
  onClose,
}: Props) {
  const [search, setSearch] = useState(editing ?? '');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Recipes first, so Enter picks the recipe you were looking for. Then the
  // typed text as a meal of its own, then "Äta ute".
  const recipesFound = recipeItems(recipes, search);
  const custom = customItem(search, recipesFound);
  const showEatOut = EAT_OUT_LABEL.toLowerCase().includes(search.trim().toLowerCase());
  const options: PaletteItem[] = [
    ...recipesFound.slice(0, MAX_RECIPES),
    ...(custom ? [custom] : []),
    ...(showEatOut ? [eatOutItem] : []),
  ];
  const active = Math.min(highlight, options.length - 1);
  const optionId = (i: number) => `${listId}-${i}`;

  // Opened on a meal and left as it was: closing must never change the meal,
  // whatever the name happens to match in the list.
  const untouched = editing !== undefined && cleanTitle(search) === cleanTitle(editing);

  // Select the name of the meal being changed, so typing replaces it.
  useEffect(() => {
    if (editing !== undefined) inputRef.current?.select();
  }, [editing]);

  // Clicking anywhere outside the popup saves what is typed, the way a text
  // box usually keeps its text when you click away. Nothing typed: just close.
  // (Escape is the way to throw the text away.)
  //
  // Only a whole click counts, one that was both pressed and released outside
  // while the popup was open:
  // - Scrolling on a phone starts with a press too, but never becomes a click.
  // - The click or press-and-hold that opened the popup began before it was
  //   there, so the finger lifting afterwards is not a click outside.
  // Both listeners run on the way down ("capture"), before anything on the
  // page can react to the click and move things around.
  const pressedOutside = useRef(false);
  useEffect(() => {
    const isOutside = (e: Event) => !rootRef.current?.contains(e.target as Node);
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside.current = isOutside(e);
    };
    const onClick = (e: MouseEvent) => {
      if (!pressedOutside.current || !isOutside(e)) return;
      pressedOutside.current = false;
      const typed = untouched ? null : typedItem(search, recipes);
      if (typed) onPick(typed);
      else onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [search, recipes, untouched, onPick, onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); // don't move the cursor in the text box
      if (options.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((active + step + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = options[active];
      // Enter straight away on a meal being changed keeps it as it is.
      if (untouched && highlight === 0) onClose();
      else if (item) onPick(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const action = editing === undefined ? 'Lägg till' : `Ändra ${editing}`;

  return (
    <div
      ref={rootRef}
      className={alignEnd ? 'quick-add quick-add-end' : 'quick-add'}
      role="dialog"
      aria-label={`${action}: ${label}`}
    >
      <input
        ref={inputRef}
        // Opening the popup is asking to type, so the text box gets focus at once.
        autoFocus={autoFocus}
        className="input quick-add-input"
        role="combobox"
        aria-label={`Sök recept eller skriv en måltid för ${label}`}
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={options.length > 0 ? optionId(active) : undefined}
        placeholder="Sök eller skriv en måltid…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" className="quick-add-list">
        {options.map((item, i) => {
          const classes = ['chip', 'quick-add-option'];
          if (item.kind === 'eat_out') classes.push('chip-eat-out');
          if (item.kind === 'custom') classes.push('chip-custom');
          if (i === active) classes.push('chip-selected');
          return (
            <li
              key={paletteItemId(item)}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={classes.join(' ')}
              // Keep focus in the text box when an option is clicked.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => onPick(item)}
            >
              <PaletteItemLabel item={item} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
