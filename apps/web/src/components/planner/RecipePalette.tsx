import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Recipe } from '@art-web/shared';
import { eatOutItem, paletteItemId, type DragData, type PaletteItem } from '../../lib/planner';

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
  const needle = search.trim().toLowerCase();
  const items: PaletteItem[] = (recipes ?? [])
    .filter((r) => r.title.toLowerCase().includes(needle))
    .map((r) => ({ kind: 'recipe', recipeId: r.id, title: r.title }));

  const selectedId = selected && paletteItemId(selected);
  const toggle = (item: PaletteItem) => onSelect(selectedId === paletteItemId(item) ? null : item);

  return (
    <aside className="palette" aria-label="Recept att planera">
      <p className="palette-hint">
        {selected
          ? `Välj en ruta för ”${selected.title}”.`
          : 'Dra till en dag, eller tryck på ett recept och sedan på en ruta.'}
      </p>
      <input
        type="search"
        className="input palette-search"
        placeholder="Sök recept…"
        aria-label="Sök recept"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="palette-list">
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
      {item.title}
    </button>
  );
}
