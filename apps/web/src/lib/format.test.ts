import { describe, expect, it } from 'vitest';
import { formatMinutes, formatServings, toLines, toTags } from './format';

describe('formatMinutes', () => {
  it.each([
    [null, null],
    [0, null],
    [45, '45 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatMinutes(input)).toBe(expected);
  });
});

describe('formatServings', () => {
  it('uses singular for one and plural otherwise', () => {
    expect(formatServings(1)).toBe('1 portion');
    expect(formatServings(4)).toBe('4 portioner');
  });
});

describe('toLines', () => {
  it('trims and drops empty lines', () => {
    expect(toLines(' a \n\n b\n')).toEqual(['a', 'b']);
  });
});

describe('toTags', () => {
  it('lowercases, trims and de-duplicates', () => {
    expect(toTags('Pasta, quick , ,pasta')).toEqual(['pasta', 'quick']);
  });
});
