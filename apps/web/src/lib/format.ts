/** 0 → null, 45 → "45 min", 90 → "1 h 30 min", 120 → "2 h" */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** 1 → "1 portion", 4 → "4 portioner" */
export function formatServings(servings: number): string {
  return `${servings} ${servings === 1 ? 'portion' : 'portioner'}`;
}

/** Split a textarea into trimmed, non-empty lines. */
export function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** "Pasta, quick , ,Dinner" → ["pasta", "quick", "dinner"] */
export function toTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
