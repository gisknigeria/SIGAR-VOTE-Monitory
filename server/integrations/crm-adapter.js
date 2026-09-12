import { createHash, randomUUID } from 'node:crypto';
import { requestWithRetry } from './retry.js';

const ALLOWED_DISPOSITIONS = new Set(['open', 'triaged', 'assigned', 'in-progress', 'resolved', 'closed', 'unknown']);
const normalize = (value) => String(value ?? '').trim();
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class CrmContractMissingError extends Error {
  constructor(message = 'CRM provider contract is not configured.') {
    super(message);
    this.code = 'CRM_CONTRACT_MISSING';
  }
}

export function createCrmAdapter({ contract, client, store, now = () => new Date().toISOString(), sleep = async () => {} } = {}) {
  const validateContract = () => {
    if (!contract?.provider || !contract?.caseIdentifier || !contract?.incrementalCursor || !contract?.authentication) {
      throw new CrmContractMissingError('CRM provider, case identifier, authentication, and incremental cursor contract are required.');
    }
    if (!client || typeof client.listCases !== 'function' || typeof client.getCase !== 'function') {
      throw new CrmContractMissingError('A CRM client implementing listCases and getCase is required; no provider endpoints are assumed.');
    }
  };
  const mapCase = (externalCase) => {
    const geography = externalCase.geography || {};
    const disposition = normalize(externalCase.disposition || externalCase.status).toLowerCase();
    const caller = externalCase.caller || externalCase.contact || {};
    return {
      externalCaseId: normalize(externalCase.id || externalCase.caseId || externalCase.externalId),
      category: normalize(externalCase.category || externalCase.type || 'unknown') || 'unknown',
      geography: { state: normalize(geography.state), lga: normalize(geography.lga), ward: normalize(geography.ward), pollingUnit: normalize(geography.pollingUnit) },
      urgency: normalize(externalCase.urgency || externalCase.priority || 'unknown').toLowerCase() || 'unknown',
      disposition: ALLOWED_DISPOSITIONS.has(disposition) ? disposition : 'unknown',
      resolutionStatus: normalize(externalCase.resolutionStatus || externalCase.resolution || 'unknown').toLowerCase() || 'unknown',
      sourceTimestamp: externalCase.updatedAt || externalCase.modifiedAt || externalCase.createdAt || null,
      sourceCreatedAt: externalCase.createdAt || null,
      sourceVersion: normalize(externalCase.version || externalCase.etag || ''),
      callerReference: caller.id || caller.externalId ? normalize(caller.id || caller.externalId) : '',
      summary: normalize(externalCase.summary || externalCase.subject || externalCase.description).slice(0, 1000),
      source: { provider: contract.provider, caseIdentifier: normalize(externalCase.id || externalCase.caseId || externalCase.externalId) },
    };
  };
  const audit = async (entry) => store?.recordCrmSyncAudit ? store.recordCrmSyncAudit(entry) : entry;
  const retry = (operation) => requestWithRetry(operation, { attempts: contract.rateLimits?.maxAttempts || 4, sleep });
  return {
    mapCase,
    async syncCases({ cursor = '', limit = 100 } = {}) {
      validateContract();
      const page = await retry(() => client.listCases({ cursor, limit, updatedSince: cursor || undefined }));
      const cases = Array.isArray(page?.cases) ? page.cases : [];
      const results = [];
      for (const externalCase of cases) {
        const mapped = mapCase(externalCase);
        if (!mapped.externalCaseId) { await audit({ id: randomUUID(), provider: contract.provider, action: 'case_skipped', reason: 'missing-external-identifier', at: now() }); continue; }
        const dedupeKey = `${contract.provider}:${mapped.externalCaseId}:${mapped.sourceVersion || mapped.sourceTimestamp || hash(mapped)}`;
        const existing = store?.findCrmCase ? await store.findCrmCase({ provider: contract.provider, externalCaseId: mapped.externalCaseId, sourceVersion: mapped.sourceVersion }) : null;
        if (existing) { results.push({ status: 'duplicate', externalCaseId: mapped.externalCaseId, internalId: existing.id }); continue; }
        const signal = store?.createIntelligenceSignal ? await store.createIntelligenceSignal({ sourceEventId: dedupeKey, signalType: 'incident', views: ['incident'], title: mapped.category, description: mapped.summary, geography: mapped.geography, source: { ...mapped.source, sourceTimestamp: mapped.sourceTimestamp, dedupeKey, urgency: mapped.urgency, disposition: mapped.disposition, resolutionStatus: mapped.resolutionStatus, callerReference: mapped.callerReference || undefined }, verificationStatus: 'unverified', recordedBy: 'crm-adapter' }) : mapped;
        if (store?.saveCrmCase) await store.saveCrmCase({ provider: contract.provider, externalCaseId: mapped.externalCaseId, sourceVersion: mapped.sourceVersion, internalId: signal?.id || '', sourceTimestamp: mapped.sourceTimestamp, updatedAt: now() });
        await audit({ id: randomUUID(), provider: contract.provider, action: 'case_imported', externalCaseId: mapped.externalCaseId, internalId: signal?.id || '', sourceTimestamp: mapped.sourceTimestamp, at: now() });
        results.push({ status: 'imported', externalCaseId: mapped.externalCaseId, internalId: signal?.id || '' });
      }
      return { results, nextCursor: page?.nextCursor ?? null, hasMore: Boolean(page?.hasMore) };
    },
    async getCase(externalCaseId) {
      validateContract();
      const externalCase = await retry(() => client.getCase(externalCaseId));
      return mapCase(externalCase);
    },
    async sendUpdate() {
      throw new CrmContractMissingError('Outbound CRM updates are disabled until the provider contract and approved workflow are supplied.');
    },
  };
}
