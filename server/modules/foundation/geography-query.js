import { getRegistrationLocationOptions, resolveCanonicalName } from '../../../shared/electionData.js';

export const GEOGRAPHY_KEYS = ['state', 'lga', 'ward', 'pollingUnit'];

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 200;

const normalizeComparableText = (value) => String(value ?? '').trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').toLowerCase();

export const normalizeGeography = (value = {}) => Object.fromEntries(GEOGRAPHY_KEYS.map((key) => [key, String(value?.[key] || '').trim()]));

export const geographyOf = (item = {}) => {
  const nested = item.geography || {};
  return {
    state: nested.state || item.state || item.state_name || 'Oyo',
    lga: nested.lga || item.lga || item.lga_name || '',
    ward: nested.ward || item.ward || '',
    pollingUnit: nested.pollingUnit || nested.polling_unit || item.pollingUnit || item.polling_unit || '',
  };
};

const hasMatch = (filterValue, recordValue) => !filterValue || normalizeComparableText(recordValue) === normalizeComparableText(filterValue);

export const matchesGeography = (item, filter = {}) => {
  const geography = geographyOf(item);
  return GEOGRAPHY_KEYS.every((key) => hasMatch(filter[key], geography[key]));
};

/**
 * Validates that a requested geography scope is a real Oyo parent chain (not an
 * arbitrary/misspelled value) before it is used to bound a query. Unlike
 * validateOyoAssignment (write-path), this allows a partial scope (state-only,
 * or state+lga) so read/drill-down requests can start broad and narrow down.
 */
export function resolveGeographyScope(filter = {}) {
  const state = String(filter.state || 'Oyo').trim() || 'Oyo';
  const rawLga = String(filter.lga || '').trim();
  const rawWard = String(filter.ward || '').trim();
  const rawPollingUnit = String(filter.pollingUnit || '').trim();
  if (!rawLga && (rawWard || rawPollingUnit)) throw new Error('An LGA is required before scoping to a ward or polling unit.');
  // Casing-tolerant, same as validateOyoAssignment: the canonical dataset's own
  // casing/hyphenation is inconsistent between entries, so a natural-language
  // scope like "Ibadan North" must resolve, not be rejected as unknown.
  const lga = rawLga ? resolveCanonicalName(getRegistrationLocationOptions(state).lgas, rawLga) : '';
  if (rawLga && !lga) throw new Error('Unknown Oyo LGA in the requested geography scope.');
  const ward = rawWard ? resolveCanonicalName(getRegistrationLocationOptions(state, lga).wards, rawWard) : '';
  if (rawWard && !ward) throw new Error('Unknown ward for the requested LGA.');
  const pollingUnit = rawPollingUnit ? resolveCanonicalName(getRegistrationLocationOptions(state, lga, ward).pollingUnits, rawPollingUnit) : '';
  if (rawPollingUnit && !pollingUnit) throw new Error('Unknown polling unit for the requested ward.');
  return { state, lga, ward, pollingUnit };
}

/** The next finer geography level to roll up children into, or null once fully drilled down. */
export function geographyDrillDownLevel({ lga, ward, pollingUnit } = {}) {
  if (pollingUnit) return null;
  if (ward) return 'pollingUnit';
  if (lga) return 'ward';
  return 'lga';
}

/**
 * Groups records by geography at the requested level, sorted by volume (roll-up).
 * Only the level being grouped by is labelled 'unknown' when missing; ancestor
 * keys fall back to '' so a missing parent never masquerades as a real value.
 */
export function buildGeographyRollup(records, level) {
  const groups = new Map();
  for (const record of records) {
    const geography = geographyOf(record);
    const keyParts = { state: geography.state || (level === 'state' ? 'unknown' : '') };
    if (level === 'lga' || level === 'ward' || level === 'pollingUnit') keyParts.lga = geography.lga || (level === 'lga' ? 'unknown' : '');
    if (level === 'ward' || level === 'pollingUnit') keyParts.ward = geography.ward || (level === 'ward' ? 'unknown' : '');
    if (level === 'pollingUnit') keyParts.pollingUnit = geography.pollingUnit || 'unknown';
    const key = JSON.stringify(keyParts);
    const group = groups.get(key) || { geography: keyParts, records: 0 };
    group.records += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.records - a.records);
}

/** Bounds an in-memory list to a safe page size and reports the true total. */
export function paginate(records, { limit, offset } = {}) {
  const total = records.length;
  const boundedLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(limit) || DEFAULT_PAGE_LIMIT));
  const boundedOffset = Math.max(0, Number(offset) || 0);
  return { items: records.slice(boundedOffset, boundedOffset + boundedLimit), total, limit: boundedLimit, offset: boundedOffset };
}

/** Preserves an unset/invalid coordinate as null instead of inventing a location. */
export function resolveOptionalCoordinate(value, previous = null) {
  if (value === undefined) return previous;
  if (value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : previous;
}
