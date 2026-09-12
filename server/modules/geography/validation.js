import { getRegistrationLocationOptions, resolveCanonicalName } from '../../../shared/electionData.js';
import { deployment, requireOyoState } from '../../config/deployment.js';

export function validateOyoAssignment(value, { multipleWards = false } = {}) {
  const state = requireOyoState(value.state || deployment.state);
  const rawLga = String(value.lga || '').trim();
  const rawWard = String(value.ward || '').trim();
  const rawPollingUnit = String(value.pollingUnit || '').trim();
  if (!rawLga && (rawWard || rawPollingUnit)) throw new Error('An LGA is required before assigning a ward or polling unit.');
  // Accepts any casing/hyphenation a caller submits (e.g. "Ibadan North") and
  // resolves it to the dataset's own exact-cased key, rather than requiring an
  // exact match against a canonical source whose casing is itself inconsistent.
  const lga = rawLga ? resolveCanonicalName(getRegistrationLocationOptions(state).lgas, rawLga) : '';
  if (rawLga && !lga) throw new Error('Select a valid Oyo LGA.');
  const rawWards = multipleWards ? rawWard.split(',').map(w => w.trim()).filter(Boolean) : rawWard ? [rawWard] : [];
  const knownWards = getRegistrationLocationOptions(state, lga).wards;
  const wards = rawWards.map((w) => resolveCanonicalName(knownWards, w));
  if (wards.some(w => !w)) throw new Error('Select wards belonging to the selected Oyo LGA.');
  const canonicalPollingUnit = rawPollingUnit && wards.length
    ? wards.map((w) => resolveCanonicalName(getRegistrationLocationOptions(state, lga, w).pollingUnits, rawPollingUnit)).find(Boolean)
    : '';
  if (rawPollingUnit && !canonicalPollingUnit) throw new Error('Select a polling unit belonging to the assigned ward.');
  return { state, lga, ward: wards.join(', '), pollingUnit: canonicalPollingUnit || '' };
}
