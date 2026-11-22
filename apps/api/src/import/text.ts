/** Small text helpers for reading web pages, shared by the files in this folder. */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aring: 'å',
  Aring: 'Å',
  auml: 'ä',
  Auml: 'Ä',
  ouml: 'ö',
  Ouml: 'Ö',
  eacute: 'é',
  Eacute: 'É',
  egrave: 'è',
  uuml: 'ü',
  Uuml: 'Ü',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  deg: '°',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  times: '×',
  reg: '®',
};

/** "Sm&ouml;r &amp; olja" → "Smör & olja" */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, code: string) => {
    if (code[0] !== '#') return NAMED_ENTITIES[code] ?? match;
    const point = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : +code.slice(1);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  });
}
