import { matchesGeography, normalizeGeography } from '../foundation/geography-query.js';

const SOURCE_PRIORITY = { 'Command Centre': 3, Supervisor: 2, Agent: 1 };
const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const sumVotes = (record) => {
  let entries = [];
  try { entries = JSON.parse(record.resultCount || '[]'); } catch { entries = []; }
  return Array.isArray(entries) ? entries.reduce((sum, entry) => sum + (Number(entry?.votes) || 0), 0) : 0;
};

/**
 * Multiple submissions can exist for the same polling unit (an Agent's and a
 * Supervisor's report for the same result, or a resubmission). Summing every
 * result_record for a geography would double- or triple-count those units, so
 * exactly one record per polling unit is kept first: prefer the highest-authority
 * source (Command Centre over Supervisor over Agent), then the most recent
 * submission among ties.
 */
export function pickCanonicalRecordsByPollingUnit(resultRecords) {
  const byUnit = new Map();
  for (const record of resultRecords) {
    const key = [record.lga, record.ward, record.pollingUnit].map(normalizeKey).join('|');
    if (key === '||') continue;
    const existing = byUnit.get(key);
    if (!existing) { byUnit.set(key, record); continue; }
    const existingPriority = SOURCE_PRIORITY[existing.resultSource] || 0;
    const candidatePriority = SOURCE_PRIORITY[record.resultSource] || 0;
    if (candidatePriority > existingPriority) byUnit.set(key, record);
    else if (candidatePriority === existingPriority && Date.parse(record.createdAt || 0) > Date.parse(existing.createdAt || 0)) byUnit.set(key, record);
  }
  return [...byUnit.values()];
}

/** Finds a registered-voters figure whose OWN geography exactly matches the requested scope -- never a broader dataset silently standing in for a narrower one. */
function findExactVotersRecord(votersDatasets, geography) {
  const requested = normalizeGeography(geography);
  for (const dataset of votersDatasets) {
    for (const record of dataset.records) {
      const recordGeography = normalizeGeography(record.geography);
      const exactMatch = Object.keys(requested).every((key) => normalizeKey(requested[key]) === normalizeKey(recordGeography[key]));
      if (exactMatch) return { value: record.value, datasetId: dataset.id, sourceName: dataset.sourceName, sourceVersion: dataset.sourceVersion, publicationDate: dataset.publicationDate };
    }
  }
  return null;
}

/**
 * Compares submitted votes for a geography against its registered-voter total,
 * when (and only when) a registered-voters figure exists for that EXACT
 * geography -- a narrower scope never borrows a broader dataset's number, since
 * that would compare unrelated denominators and could produce a false result.
 */
export function computeOverVotingCheck({ geography = {}, resultRecords = [], votersDatasets = [] }) {
  const scopedRecords = resultRecords.filter((record) => matchesGeography(record, geography));
  const canonicalRecords = pickCanonicalRecordsByPollingUnit(scopedRecords);
  const submittedVotes = canonicalRecords.reduce((sum, record) => sum + sumVotes(record), 0);
  const pollingUnitsReporting = canonicalRecords.length;
  const votersRecord = findExactVotersRecord(votersDatasets, geography);

  const methodology = 'Submitted votes are deduplicated to one canonical record per polling unit (preferring Command Centre, then Supervisor, then Agent, then the most recent submission among ties) before summing, so multiple field submissions for the same polling unit are not double-counted.';

  if (!votersRecord) {
    return {
      geography: normalizeGeography(geography),
      submittedVotes,
      pollingUnitsReporting,
      registeredVoters: null,
      status: 'unknown',
      excessVotes: null,
      methodology,
      note: 'No registered-voter figure is available for this exact geography scope, so an over-voting check cannot be performed here. A figure for a broader geography (e.g. the whole state) is never substituted for a narrower one.',
    };
  }

  const excessVotes = submittedVotes - votersRecord.value;
  return {
    geography: normalizeGeography(geography),
    submittedVotes,
    pollingUnitsReporting,
    registeredVoters: votersRecord.value,
    registeredVotersSource: { datasetId: votersRecord.datasetId, sourceName: votersRecord.sourceName, sourceVersion: votersRecord.sourceVersion, publicationDate: votersRecord.publicationDate },
    status: excessVotes > 0 ? 'exceeds-registered-voters' : 'within-bounds',
    excessVotes: excessVotes > 0 ? excessVotes : 0,
    methodology,
  };
}
