export function validateResultEntries(values, parties) {
  if (!Array.isArray(values) || values.length === 0 || values.length > 100) {
    throw new Error('Supply between 1 and 100 party results.');
  }
  const known = new Set(parties), seen = new Set();
  return values.map(item => {
    const party = typeof item?.party === 'string' ? item.party.trim() : '';
    const raw = item?.votes;
    if (!known.has(party) || seen.has(party)) throw new Error('Every result must identify a distinct registered party.');
    if (!['number', 'string'].includes(typeof raw) || String(raw).trim() === '') throw new Error('Missing vote counts must not be recorded as zero.');
    const votes = Number(raw);
    if (!Number.isSafeInteger(votes) || votes < 0) throw new Error('Vote counts must be non-negative safe integers.');
    seen.add(party);
    return { party, votes };
  });
}
