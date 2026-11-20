import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatDayMonth,
  formatWeekday,
  isIsoDate,
  isoWeekNumber,
  startOfWeek,
  todayIso,
  weekDays,
} from './dates';

describe('isIsoDate', () => {
  it.each([
    ['2026-11-16', true],
    ['2026-02-30', false],
    ['16/11/2026', false],
    ['', false],
  ])('%s → %s', (value, expected) => {
    expect(isIsoDate(value)).toBe(expected);
  });
});

describe('todayIso', () => {
  it('uses the local calendar day and pads month and day', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is not thrown off by daylight saving time', () => {
    // Sweden switches to summer time on 2026-03-29.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
});

describe('startOfWeek', () => {
  it.each([
    ['2026-11-16', '2026-11-16'], // Monday
    ['2026-11-20', '2026-11-16'], // Friday
    ['2026-11-22', '2026-11-16'], // Sunday belongs to the week that started on Monday
  ])('%s → %s', (day, monday) => {
    expect(startOfWeek(day)).toBe(monday);
  });
});

describe('weekDays', () => {
  it('returns Monday to Sunday', () => {
    const days = weekDays('2026-11-16');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-11-16');
    expect(days[6]).toBe('2026-11-22');
  });
});

describe('isoWeekNumber', () => {
  it.each([
    ['2026-11-20', 47],
    ['2026-01-01', 1],
    ['2027-01-01', 53], // a Friday, still in the last week of 2026
    ['2024-12-30', 1], // a Monday, already week 1 of 2025
  ])('%s is in week %s', (day, week) => {
    expect(isoWeekNumber(day)).toBe(week);
  });
});

describe('formatting', () => {
  it('writes days in Swedish', () => {
    expect(formatWeekday('2026-11-16')).toBe('måndag');
    expect(formatDayMonth('2026-11-16')).toMatch(/^16 nov/);
  });
});
