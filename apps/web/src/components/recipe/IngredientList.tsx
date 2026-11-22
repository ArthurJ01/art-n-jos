import { useState } from 'react';
import { groupLines } from '@art-web/shared';
import { hasUnreadAmount, parseIngredient, scaledAmount } from '../../lib/ingredients';

interface Props {
  ingredients: string[];
  /** How many portions the recipe is written for. Without it there is nothing to recalculate. */
  servings: number | null;
}

/**
 * The ingredients as a list to tick off, in groups ("Sås:"), with the amount
 * of each on the right. The − / + buttons recalculate the amounts for another
 * number of portions.
 */
export function IngredientList({ ingredients, servings }: Props) {
  const [portions, setPortions] = useState(servings ?? 1);
  const factor = servings ? portions / servings : 1;

  const groups = groupLines(ingredients).map((group) => ({
    heading: group.heading,
    rows: group.lines.map((line) => {
      const ingredient = parseIngredient(line);
      return {
        name: ingredient.name,
        amount: scaledAmount(ingredient, factor),
        // A number the recalculation could not read, so the line is as it was typed.
        unread: factor !== 1 && hasUnreadAmount(line, ingredient),
      };
    }),
  }));
  const unreadAmounts = groups.some((group) => group.rows.some((row) => row.unread));

  return (
    <section className="ingredients-panel" aria-labelledby="ingredients-heading">
      <h2 id="ingredients-heading">Ingredienser</h2>

      {servings && (
        <div className="stepper" role="group" aria-label="Antal portioner">
          <button
            type="button"
            className="stepper-button"
            aria-label="Färre portioner"
            disabled={portions <= 1}
            onClick={() => setPortions(portions - 1)}
          >
            −
          </button>
          {/* <output> is announced by screen readers when the number changes. */}
          <output className="stepper-value">{portions} port</output>
          <button
            type="button"
            className="stepper-button"
            aria-label="Fler portioner"
            disabled={portions >= 100}
            onClick={() => setPortions(portions + 1)}
          >
            +
          </button>
        </div>
      )}

      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="ingredient-group">
          {group.heading && <h3 className="group-heading">{group.heading}:</h3>}
          <ul className="tick-list">
            {group.rows.map((row, rowIndex) => (
              <li key={rowIndex}>
                {/* A label around a checkbox: the whole row can be clicked. */}
                <label className="tick-row">
                  <input type="checkbox" className="tick" />
                  <span className="ingredient-name">
                    {row.name}
                    {row.unread && ' *'}
                  </span>
                  {/* The space is for screen readers, which read the row as one text. */}{' '}
                  <span className="ingredient-amount">{row.amount}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {servings && factor !== 1 && (
        <p className="ingredients-footnote">
          Omräknat från {servings} port. Mängder och tider i beskrivningen är inte omräknade.
          {unreadAmounts && ' Rader med * har en mängd som inte gick att räkna om.'}
        </p>
      )}
    </section>
  );
}
