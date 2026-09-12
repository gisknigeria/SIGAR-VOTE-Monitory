import { createHash, randomUUID } from 'node:crypto';
import { deployment, getDeploymentConfig, isConfiguredScope } from '../../config/deployment.js';
import { normalizeSourceClassification, SOURCE_CLASSIFICATIONS } from '../foundation/provenance.js';

export const REFERENCE_CLASSIFICATIONS = SOURCE_CLASSIFICATIONS;

const stableJson = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
};

const hashPayload = (value) => createHash('sha256').update(stableJson(value)).digest('hex');

const validateRecord = (record, index) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, reason: 'record must be an object' };
  const providerId = String(record.providerId || record.externalId || record.sourceRecordId || record.providerRecordId || '').trim();
  const hasIdentity = Boolean(String(record.canonicalId || record.id || record.name || '').trim());
  const hasGeography = Boolean(String(record.state || record.lga || record.ward || record.pollingUnit || '').trim());
  if (!providerId) return { valid: false, reason: `row ${index + 1} is missing a provider identifier` };
  if (!hasIdentity && !hasGeography) return { valid: false, reason: `row ${index + 1} has no canonical identity or geography` };
  return { valid: true, providerId };
};

export function createReferenceDataRepository({ pool, jsonDb, saveJson }) {
  const releaseKey = (id) => `reference-release:${id}`;
  const readReleases = async () => {
    if (!pool) {
      jsonDb.referenceDataReleases ||= {};
      return Object.values(jsonDb.referenceDataReleases);
    }
    return (await pool.query("select value from app_settings where key like 'reference-release:%' order by key")).rows.map((row) => row.value);
  };
  const saveRelease = async (release) => {
    if (!pool) {
      jsonDb.referenceDataReleases ||= {};
      jsonDb.referenceDataReleases[releaseKey(release.id)] = release;
      saveJson();
      return release;
    }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do nothing', [releaseKey(release.id), JSON.stringify(release)]);
    return release;
  };
  return {
    async ingestReferenceData({ sourceId, sourceName, sourceUrl = '', sourceVersion, classification, records, fetchedAt, ingestedBy = '', electionId = deployment.electionId, scopeId = deployment.scopeId }) {
      const normalizedClassification = normalizeSourceClassification(classification, '');
      if (!REFERENCE_CLASSIFICATIONS.includes(normalizedClassification)) throw new Error(`Invalid reference data classification. Use: ${REFERENCE_CLASSIFICATIONS.join(', ')}`);
      if (!String(sourceId || '').trim() || !String(sourceName || '').trim() || !String(sourceVersion || '').trim()) throw new Error('sourceId, sourceName, and sourceVersion are required.');
      if (!Array.isArray(records) || !records.length) throw new Error('Reference data records are required.');
      const resolvedScopeId = String(scopeId || getDeploymentConfig().scopeId || deployment.scopeId || 'ng-oyo').trim() || 'ng-oyo';
      if (!isConfiguredScope(resolvedScopeId, getDeploymentConfig({ scopeId: resolvedScopeId }))) {
        throw new Error(`Reference data ingestion is restricted to the Oyo scope. Received: '${resolvedScopeId}'. Allowed scopes: ${getDeploymentConfig({ scopeId: resolvedScopeId }).allowedScopeIds.join(', ') || 'none'}.`);
      }
      const resolvedElectionId = String(electionId || getDeploymentConfig({ scopeId: resolvedScopeId }).electionId || 'ng-oyo-election').trim() || 'ng-oyo-election';
      const payload = { sourceId: String(sourceId).trim(), sourceVersion: String(sourceVersion).trim(), classification: normalizedClassification, records };
      const contentHash = hashPayload(payload);
      const existing = (await readReleases()).find((release) => release.sourceId === payload.sourceId && release.sourceVersion === payload.sourceVersion);
      if (existing) {
        if (existing.contentHash !== contentHash) throw new Error('This source version already exists with different content.');
        return existing;
      }
      const now = new Date().toISOString();
      const validatedRecords = records.map((record, index) => {
        const validation = validateRecord(record, index);
        return {
          ...record,
          providerId: validation.providerId || String(record?.providerId || record?.externalId || record?.sourceRecordId || '').trim(),
          validationStatus: validation.valid ? 'valid' : 'quarantined',
          quarantineReason: validation.valid ? '' : validation.reason,
          scopeId: resolvedScopeId,
          electionId: resolvedElectionId,
          sourceId: payload.sourceId,
          sourceVersion: payload.sourceVersion,
          sourceClassification: normalizedClassification,
          ingestedAt: now,
        };
      });
      const release = {
        id: randomUUID(),
        sourceId: payload.sourceId,
        sourceName: String(sourceName).trim(),
        sourceUrl: String(sourceUrl || '').trim(),
        sourceVersion: payload.sourceVersion,
        classification: normalizedClassification,
        scopeId: resolvedScopeId,
        electionId: resolvedElectionId,
        records: validatedRecords,
        validRecordCount: validatedRecords.filter((record) => record.validationStatus === 'valid').length,
        quarantinedRecordCount: validatedRecords.filter((record) => record.validationStatus === 'quarantined').length,
        recordCount: records.length,
        contentHash,
        fetchedAt: fetchedAt || now,
        ingestedAt: now,
        approvedBy: '',
        approvedAt: '',
        ingestedBy: String(ingestedBy || '').trim(),
        status: 'pending-approval',
        immutable: true,
      };
      return saveRelease(release);
    },
    async approveReferenceData(id, { approvedBy = '', approvedByRole = '' } = {}) {
      const reviewer = String(approvedBy || '').trim();
      if (!reviewer) throw new Error('Authenticated approval attribution is required.');
      const releases = await readReleases();
      const release = releases.find((candidate) => candidate.id === id);
      if (!release) throw new Error('Reference data release was not found.');
      if (!release.validRecordCount) throw new Error('A release with no valid records cannot be approved.');
      if (release.status === 'approved') return release;
      const approved = { ...release, status: 'approved', approvedBy: reviewer, approvedByRole: String(approvedByRole || '').trim(), approvedAt: new Date().toISOString() };
      if (!pool) {
        jsonDb.referenceDataReleases[releaseKey(release.id)] = approved;
        saveJson();
        return approved;
      }
      await pool.query('update app_settings set value=$2 where key=$1', [releaseKey(release.id), JSON.stringify(approved)]);
      return approved;
    },
    async referenceDataReleases({ sourceId, classification, status } = {}) {
      return (await readReleases()).filter((release) =>
        (!sourceId || release.sourceId === sourceId) &&
        (!classification || release.classification === normalizeSourceClassification(classification, classification)) &&
        (!status || release.status === status),
      );
    },
    async activeReferenceData({ sourceId, classification } = {}) {
      const releases = await this.referenceDataReleases({ sourceId, classification, status: 'approved' });
      const latest = new Map();
      for (const release of releases) {
        const prior = latest.get(release.sourceId);
        if (!prior || release.ingestedAt > prior.ingestedAt) latest.set(release.sourceId, release);
      }
      return [...latest.values()].map((release) => ({
        ...release,
        records: (release.records || []).filter((record) => record.validationStatus !== 'quarantined'),
      }));
    },
  };
}
