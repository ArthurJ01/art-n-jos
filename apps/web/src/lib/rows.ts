/**
 * The rows of the recipe builder.
 *
 * A recipe stores its ingredients and steps as plain lines, where a line
 * ending with a colon is a heading ("Sås:"). The builder shows each line as a
 * row of its own, and a heading as a different kind of row, so nobody has to
 * know about the colon. These functions convert between the two.
 */
import { headingText, isHeadingLine, toHeadingLine } from '@art-web/shared';

export interface Row {
  /** Only for React, to tell the rows apart while they are added, moved and removed. */
  id: number;
  kind: 'item' | 'heading';
  text: string;
}

let nextRowId = 1;

export const newRow = (text = '', kind: Row['kind'] = 'item'): Row => ({
  id: nextRowId++,
  kind,
  text,
});

/** One row per stored line. Always at least one row, so there is somewhere to type. */
export function rowsFromLines(lines: string[]): Row[] {
  const rows = lines.map((line) =>
    isHeadingLine(line) ? newRow(headingText(line), 'heading') : newRow(line),
  );
  return rows.length > 0 ? rows : [newRow()];
}

/**
 * The lines to store. Empty rows are left out, and headings get their colon.
 * An ordinary row loses a colon at its end ("Blanda till marinaden:"), or it
 * would come back as a heading the next time the recipe is opened.
 */
export function linesFromRows(rows: Row[]): string[] {
  return rows
    .map((row) => ({ kind: row.kind, text: headingText(row.text) }))
    .filter((row) => row.text !== '')
    .map((row) => (row.kind === 'heading' ? toHeadingLine(row.text) : row.text));
}

/**
 * Pasted text as rows, one per line: a whole ingredient list copied from
 * another page lands as separate ingredients. Bullets and numbering in front
 * ("- ", "• ", "1. ", "2) ") are dropped.
 */
export function rowsFromPaste(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-–•*·]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
    .map((line) => (isHeadingLine(line) ? newRow(headingText(line), 'heading') : newRow(line)));
}
