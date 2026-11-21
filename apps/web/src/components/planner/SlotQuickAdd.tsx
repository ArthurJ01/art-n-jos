import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Recipe } from '@art-web/shared';
import {
  customItem,
  EAT_OUT_LABEL,
  eatOutItem,
  paletteItemId,
  recipeItems,
  type PaletteItem,
} from '../../lib/planner';
import { PaletteItemLabel } from './PaletteItemLabel';

/** Enough to pick from without the popup growing taller than the slots around it. */
const MAX_RECIPES = 6;

interface Props {
  /** "onsdag middag", for the screen reader label. */
  label: string;
  recipes: Recipe[] | undefined;
  /** Open towards the left, for the last days of the week. */
  alignEnd: boolean;
  onPick: (item: PaletteItem) => void;
  onClose: () => void;
}

/**
 * A small search box that opens inside a slot (on double-click), to add a
 * meal there without going through the list on the left.
 *
 * It follows the ARIA "combobox" pattern: focus stays in the text box while
 * the arrow keys move a highlight through the list (aria-activedescendant).
 */
export function SlotQuickAdd({ label, recipes, alignEnd, onPick, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
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

  // Close when clicking anywhere outside the popup.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); // don't move the cursor in the text box
      if (options.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((active + step + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = options[active];
      if (item) onPick(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      ref={rootRef}
      className={alignEnd ? 'quick-add quick-add-end' : 'quick-add'}
      role="dialog"
      aria-label={`Lägg till: ${label}`}
    >
      <input
        // Opening the popup is asking to type, so the text box gets focus at once.
        autoFocus
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
