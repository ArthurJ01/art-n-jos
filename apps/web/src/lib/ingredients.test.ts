import { describe, expect, it } from 'vitest';
import { formatQuantity, parseIngredient, scaledAmount } from './ingredients';

/** "amount | name", to keep the table below readable. */
const split = (line: string) => {
  const { amount, name } = parseIngredient(line);
  return `${amount} | ${name}`;
};

describe('parseIngredient', () => {
  it('splits a line into amount and name', () => {
    expect(split('200 g spaghetti')).toBe('200 g | spaghetti');
    expect(split('ca 500 g strimlad kycklingbröstfilé')).toBe(
      'ca 500 g | strimlad kycklingbröstfilé',
    );
    expect(split('2dl vispgrädde')).toBe('2dl | vispgrädde');
    expect(split('1 msk. smör')).toBe('1 msk. | smör');
    expect(split('1 burk (400 g) krossade tomater')).toBe('1 burk | (400 g) krossade tomater');
    expect(split('4 cloves garlic, thinly sliced')).toBe('4 cloves | garlic, thinly sliced');
  });

  it('keeps words that are not units in the name', () => {
    expect(split('4 vitlöksklyftor')).toBe('4 | vitlöksklyftor');
    expect(split('1 lime, saften')).toBe('1 | lime, saften');
    // "g" is a unit, but "gula" only starts with it.
    expect(split('2 gula lökar')).toBe('2 | gula lökar');
    expect(split('1 liten rödlök')).toBe('1 | liten rödlök');
  });

  it('reads fractions, decimals and ranges', () => {
    expect(parseIngredient('½ tsk salt').quantity).toMatchObject({ min: 0.5, unit: 'tsk' });
    expect(parseIngredient('1 ½ dl mjölk').quantity).toMatchObject({ min: 1.5, unit: 'dl' });
    expect(parseIngredient('1½ dl mjölk').quantity).toMatchObject({ min: 1.5, unit: 'dl' });
    expect(parseIngredient('1/2 cup sugar').quantity).toMatchObject({ min: 0.5, unit: 'cup' });
    expect(parseIngredient('1 1/2 cups flour').quantity).toMatchObject({ min: 1.5, unit: 'cups' });
    expect(parseIngredient('1,5 kg potatis').quantity).toMatchObject({ min: 1.5, unit: 'kg' });
    expect(parseIngredient('2–3 msk olja').quantity).toMatchObject({ min: 2, max: 3 });
    expect(parseIngredient('2 - 3 msk olja').quantity).toMatchObject({ min: 2, max: 3 });
  });

  it('leaves lines without an amount alone', () => {
    for (const line of ['Salt och peppar', 'Parsley', 'Saften av 1 lime', '5-kryddor', '2 dl']) {
      expect(parseIngredient(line)).toEqual({ amount: '', name: line, quantity: null });
    }
  });
});

describe('scaledAmount', () => {
  const scale = (line: string, factor: number) => scaledAmount(parseIngredient(line), factor);

  it('shows the amount exactly as written when nothing changes', () => {
    expect(scale('ca 500 g kyckling', 1)).toBe('ca 500 g');
    expect(scale('1,5 kg potatis', 1)).toBe('1,5 kg');
    expect(scale('Salt', 2)).toBe('');
  });

  it('recalculates for more or fewer portions', () => {
    expect(scale('ca 500 g kyckling', 1.5)).toBe('ca 750 g');
    expect(scale('4 vitlöksklyftor', 0.5)).toBe('2');
    expect(scale('½ tsk salt', 1.5)).toBe('¾ tsk');
    expect(scale('1 rödlök', 1.5)).toBe('1 ½');
    expect(scale('2 dl vatten', 2)).toBe('4 dl');
    expect(scale('2–3 msk olja', 2)).toBe('4–6 msk');
    expect(scale('1 msk socker', 0.25)).toBe('¼ msk');
  });
});

describe('formatQuantity', () => {
  it('rounds to amounts that can be measured', () => {
    expect(formatQuantity(187.5)).toBe('190');
    expect(formatQuantity(12.4)).toBe('12');
    expect(formatQuantity(3)).toBe('3');
    expect(formatQuantity(2.95)).toBe('3');
    expect(formatQuantity(0.375)).toBe('⅓');
    expect(formatQuantity(1.6667)).toBe('1 ⅔');
    expect(formatQuantity(0.125)).toBe('⅛');
    expect(formatQuantity(0.05)).toBe('0,05');
  });
});
