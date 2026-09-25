/**
 * Matches free-typed ward labels ("AGUODO/MASIFA . WARD 3", "WARD3", "03", "MASIFA AGUODO",
 * "ALASA WARD 05") onto the INEC ward names of one LGA ("AGUODO/ MASIFA", "ISALE ALAASA").
 *
 * 1. By name: the label's words are compared with each ward's words, ignoring doubled letters
 *    and one-letter slips (ALASA ~ ALAASA, TAARA ~ TARA). A single clear winner is taken.
 * 2. By number: when INEC's ward codes are known (the polling-unit register gives them), "WARD 7"
 *    or "07" is ward 07 of the LGA. Without codes, labels that carry both a name and a number
 *    ("ISALE AFON WARD 04") teach which number belongs to which ward, and number-only labels
 *    follow. Numbers are never assumed from list order: the register is alphabetical.
 *
 * Anything still unplaced is returned as unmatched, never guessed. Used by the server (member
 * and call records) and the browser (GRID3 ward boundaries), so both agree on the same ward.
 */

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15 };
const STOP = new Set(['ward', 'wards', 'the', 'and', 'lga', 'local', 'government', 'area', 'unit', 'units', 'oyo', ...Object.keys(NUMBER_WORDS)]);

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const squeeze = (word) => word.replace(/(.)\1+/g, '$1');
/** Words of a ward name; Roman numerals and trailing digits become "#n" so TEDE I and TEDE II differ. */
export const wardWords = (value) => String(value ?? '')
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .flatMap((word) => {
    if (ROMAN[word]) return [`#${ROMAN[word]}`];
    if (/^\d{1,2}$/.test(word)) return [`#${Number(word)}`];
    return word.length >= 3 && !STOP.has(word) && !/\d/.test(word) ? [squeeze(word)] : [];
  });

export function wardNumber(value) {
  const text = String(value ?? '').toLowerCase().replace(/\bo(\d)/g, '0$1'); // "WARD O5" -> 05
  const tagged = text.match(/ward\s*(?:no\.?\s*)?0*(\d{1,2})\b/) || text.match(/^\s*0*(\d{1,2})\s*(?:[:.)-]|\s+[a-z]|$)/) || text.match(/\b0*(\d{1,2})\s*$/);
  if (tagged) return Number(tagged[1]) || null;
  const word = text.match(/ward\s+([a-z]+)/)?.[1] || text.match(/\b([a-z]+)\s*$/)?.[1];
  return NUMBER_WORDS[word] || (/ward\s+[ivx]+\b/.test(text) ? ROMAN[word] : null) || null;
}

const close = (a, b) => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  // One edit apart (insert, delete or substitute).
  let i = 0; let j = 0; let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1; else if (b.length > a.length) j += 1; else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};

/** Best ward by shared words, or '' when none or tied. */
export function wardByName(label, wards) {
  const words = wardWords(label);
  if (!words.some((word) => !word.startsWith('#'))) return '';
  let best = ''; let bestScore = 0; let tied = false;
  for (const ward of wards) {
    const target = wardWords(ward);
    const named = target.filter((word) => !word.startsWith('#'));
    if (!named.some((other) => words.some((word) => close(word, other)))) continue;
    const score = words.filter((word) => target.some((other) => close(word, other))).length / Math.max(target.length, 1);
    if (score > bestScore) { best = ward; bestScore = score; tied = false; } else if (score && score === bestScore) tied = true;
  }
  return !tied && bestScore >= 0.5 ? best : '';
}

/**
 * Returns match(label) -> ward name or '' for one LGA. `numbered` (Map of INEC ward number ->
 * ward name) is used when known; otherwise ward numbers are learned from `labels`.
 */
export function createWardMatcher(wards, labels = [], numbered = null) {
  if (numbered?.size) {
    const cache = new Map();
    return (label) => {
      if (!cache.has(label)) cache.set(label, wardByName(label, wards) || numbered.get(wardNumber(label)) || '');
      return cache.get(label);
    };
  }
  const votes = new Map();
  for (const label of labels) {
    const ward = wardByName(label, wards);
    const number = wardNumber(label);
    if (!ward || !number) continue;
    const key = `${number}`;
    if (!votes.has(key)) votes.set(key, new Map());
    votes.get(key).set(ward, (votes.get(key).get(ward) || 0) + 1);
  }
  const byNumber = new Map();
  for (const [number, counts] of votes) {
    const [ward, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    if (count / total >= 0.6) byNumber.set(Number(number), ward);
  }
  const cache = new Map();
  return (label) => {
    if (cache.has(label)) return cache.get(label);
    const ward = wardByName(label, wards) || byNumber.get(wardNumber(label)) || '';
    cache.set(label, ward);
    return ward;
  };
}
