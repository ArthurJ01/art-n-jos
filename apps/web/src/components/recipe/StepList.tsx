import { groupLines } from '@art-web/shared';

/**
 * The steps as a numbered list to tick off while cooking. Headings ("Sås:")
 * split it into parts; the numbers keep counting across them, so "step 7" is
 * always the same step.
 */
export function StepList({ steps }: { steps: string[] }) {
  // Each group with the number of its first step.
  const groups = groupLines(steps).map((group, i, all) => ({
    ...group,
    first: 1 + all.slice(0, i).reduce((count, earlier) => count + earlier.lines.length, 0),
  }));

  return (
    <section aria-labelledby="steps-heading">
      <h2 id="steps-heading">Gör så här</h2>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.heading && <h3 className="group-heading">{group.heading}:</h3>}
          {/* The numbers are written out (and list-style is off) so that they
              sit inside the label and are read together with the step. */}
          <ol className="steps">
            {group.lines.map((step, i) => (
              <li key={i} className="step">
                <label className="step-row">
                  <input type="checkbox" className="tick" />
                  <span className="step-number">{group.first + i}.</span>{' '}
                  <span className="step-text">{step}</span>
                </label>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
