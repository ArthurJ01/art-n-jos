import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Recipe } from '@art-web/shared';
import {
  customItem as customItemFor,
  eatOutItem,
  paletteItemId,
  recipeItems,
  type DragData,
  type PaletteItem,
} from '../../lib/planner';
import { PaletteItemLabel } from './PaletteItemLabel';

interface Props {
  recipes: Recipe[] | undefined;
  isPending: boolean;
  /** The item picked by clicking, waiting to be placed in a slot. */
  selected: PaletteItem | null;
  onSelect: (item: PaletteItem | null) => void;
}

/** The list of things that can be put into the calendar. */
export function RecipePalette({ recipes, isPending, selected, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const needle = search.trim();
  const items = recipeItems(recipes, search);
  const customItem = customItemFor(search, items);

  const selectedId = selected && paletteItemId(selected);
  const toggle = (item: PaletteItem) => onSelect(selectedId === paletteItemId(item) ? null : item);

  return (
    <aside className="palette" aria-label="Recept att planera">
      <p className="palette-hint">
        {selected
          ? `Välj en ruta för ”${selected.title}”.`
          : 'Dra till en dag, eller tryck på ett recept och sedan på en ruta. Dubbelklicka på en ruta för att skriva in en måltid direkt.'}
      </p>
      <input
        type="search"
        className="input palette-search"
        placeholder="Sök recept eller skriv en egen måltid…"
        aria-label="Sök recept eller skriv en egen måltid"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="palette-list">
        {customItem && (
          <PaletteButton
            item={customItem}
            selected={selectedId === paletteItemId(customItem)}
            onClick={() => toggle(customItem)}
          />
        )}
        <PaletteButton
          item={eatOutItem}
          selected={selectedId === 'eat_out'}
          onClick={() => toggle(eatOutItem)}
        />
        {items.map((item) => (
          <PaletteButton
            key={paletteItemId(item)}
            item={item}
            selected={selectedId === paletteItemId(item)}
            onClick={() => toggle(item)}
          />
        ))}
        {isPending && <span className="muted">Laddar…</span>}
        {recipes && items.length === 0 && (
          <span className="muted">{needle ? 'Inga recept matchar.' : 'Inga recept än.'}</span>
        )}
      </div>
    </aside>
  );
}

function PaletteButton({
  item,
  selected,
  onClick,
}: {
  item: PaletteItem;
  selected: boolean;
  onClick: () => void;
}) {
  const data: DragData = { type: 'new', item };
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: `palette:${paletteItemId(item)}`,
    data,
    attributes: { roleDescription: 'dragbar' },
  });

  const classes = ['chip', 'palette-item'];
  if (item.kind === 'eat_out') classes.push('chip-eat-out');
  if (item.kind === 'custom') classes.push('chip-custom');
  if (selected) classes.push('chip-selected');

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      {...listeners}
      {...attributes}
      // After the spread: dnd-kit's attributes include their own aria-pressed.
      aria-pressed={selected}
    >
      <PaletteItemLabel item={item} />
    </button>
  );
}
