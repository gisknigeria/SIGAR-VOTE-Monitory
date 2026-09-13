import { getRegistrationLocationOptions } from '../../../shared/electionData.js';
import { deployment } from '../../config/deployment.js';

const BASELINE_SOURCE_ID = 'oyo-bundled-geography';

/**
 * Result submission requires an approved reference-data release covering the polling unit
 * (server/modules/results/routes.js). On a fresh deployment no release exists, so every field
 * submission is rejected with a 400 that the agent never asked for and cannot fix.
 *
 * The bundled Oyo ward/polling-unit dataset in shared/electionData.js is already the
 * authoritative list the same route validates against two checks earlier, so this registers it
 * as a real, visible, approved release rather than special-casing the gate. A genuine ingested
 * release from INEC (or anywhere else) supersedes it normally -- this only fills the gap so the
 * platform works before one has been loaded.
 */
export async function ensureBaselineReferenceData(store, { state = deployment.state || 'Oyo' } = {}) {
  if (typeof store.referenceDataReleases !== 'function') return null;
  const existing = await store.referenceDataReleases({ sourceId: BASELINE_SOURCE_ID });
  const approved = existing.find((release) => release.status === 'approved');
  if (approved) return approved;

  const records = [];
  for (const lga of getRegistrationLocationOptions(state).lgas) {
    for (const ward of getRegistrationLocationOptions(state, lga).wards) {
      records.push({
        providerId: `${state}/${lga}/${ward}`,
        name: ward,
        state,
        lga,
        ward,
      });
    }
  }
  if (!records.length) return null;

  const release = await store.ingestReferenceData({
    sourceId: BASELINE_SOURCE_ID,
    sourceName: `${state} bundled ward and polling-unit register`,
    sourceVersion: deployment.sourceVersion || 'bundled-v1',
    classification: 'authoritative-master',
    records,
    ingestedBy: 'system',
  });
  const result = await store.approveReferenceData(release.id, { approvedBy: 'system', approvedByRole: 'System' });
  console.log(`[reference-data] Registered bundled ${state} baseline release (${records.length} wards) so field result submission works before an external release is ingested.`);
  return result;
}
