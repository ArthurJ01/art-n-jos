import { CUSTOM_LABEL, type PaletteItem } from '../../lib/planner';

/** The text of a palette item. A custom meal says so, so it isn't mistaken for a recipe. */
export function PaletteItemLabel({ item }: { item: PaletteItem }) {
  if (item.kind !== 'custom') return <>{item.title}</>;
  return (
    <>
      <span className="chip-kicker">{CUSTOM_LABEL}:</span> {item.title}
    </>
  );
}
