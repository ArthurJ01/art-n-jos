import { describe, expect, it } from 'vitest';
import { linesFromRows, newRow, rowsFromLines, rowsFromPaste } from './rows';

/** Rows without their ids, which are different every time. */
const plain = (rows: { kind: string; text: string }[]) =>
  rows.map(({ kind, text }) => ({ kind, text }));

describe('builder rows', () => {
  it('shows a stored heading as a heading row, without its colon', () => {
    expect(plain(rowsFromLines(['2 dl grädde', 'Sås:', '1 msk soja']))).toEqual([
      { kind: 'item', text: '2 dl grädde' },
      { kind: 'heading', text: 'Sås' },
      { kind: 'item', text: '1 msk soja' },
    ]);
  });

  it('starts an empty list with one empty row to type in', () => {
    expect(plain(rowsFromLines([]))).toEqual([{ kind: 'item', text: '' }]);
  });

  it('stores what it was given', () => {
    const lines = ['2 dl grädde', 'Sås:', '1 msk soja', 'Till servering:', 'Ris'];
    expect(linesFromRows(rowsFromLines(lines))).toEqual(lines);
  });

  it('leaves out empty rows and keeps an ordinary row from turning into a heading', () => {
    const rows = [
      newRow('  2 dl grädde '),
      newRow('   '),
      newRow('Sås:', 'heading'),
      newRow('', 'heading'),
      newRow('Blanda till marinaden:'),
    ];
    expect(linesFromRows(rows)).toEqual(['2 dl grädde', 'Sås:', 'Blanda till marinaden']);
  });

  it('makes one row per pasted line, without bullets and numbering', () => {
    const pasted =
      '- 2 dl grädde\r\n• 1 msk soja\n\n3. Koka upp.\n2) Rör om.\nTill servering:\nRis';
    expect(plain(rowsFromPaste(pasted))).toEqual([
      { kind: 'item', text: '2 dl grädde' },
      { kind: 'item', text: '1 msk soja' },
      { kind: 'item', text: 'Koka upp.' },
      { kind: 'item', text: 'Rör om.' },
      { kind: 'heading', text: 'Till servering' },
      { kind: 'item', text: 'Ris' },
    ]);
    // An amount is not numbering: "2 dl" has no dot or bracket after the number.
    expect(plain(rowsFromPaste('2 dl grädde'))).toEqual([{ kind: 'item', text: '2 dl grädde' }]);
  });
});
