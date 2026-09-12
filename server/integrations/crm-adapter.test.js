import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrmAdapter, CrmContractMissingError } from './crm-adapter.js';

const contract = {
  provider: 'test-crm',
  caseIdentifier: 'id',
  incrementalCursor: 'updatedAt',
  authentication: 'injected-client',
  rateLimits: { maxAttempts: 3 },
};

function storeFixture() {
  const signals = [];
  const cases = [];
  const audits = [];
  return {
    signals,
    cases,
    audits,
    async createIntelligenceSignal(input) { const signal = { id: `signal-${signals.length + 1}`, ...input }; signals.push(signal); return signal; },
    async findCrmCase(input) { return cases.find((item) => item.provider === input.provider && item.externalCaseId === input.externalCaseId && (!input.sourceVersion || item.sourceVersion === input.sourceVersion)) || null; },
    async saveCrmCase(value) { cases.push(value); return value; },
    async recordCrmSyncAudit(value) { audits.push(value); return value; },
  };
}

test('CRM adapter fails closed without a provider contract or injected client', async () => {
  const adapter = createCrmAdapter({});
  await assert.rejects(adapter.syncCases(), (error) => error instanceof CrmContractMissingError);
});

test('CRM cases map to restricted intelligence metadata and deduplicate by provider identity/version', async () => {
  const store = storeFixture();
  const client = { async listCases() { return { cases: [{ id: 'case-1', category: 'Network', geography: { state: 'Oyo', lga: 'Ibadan North' }, priority: 'high', status: 'open', updatedAt: '2026-09-11T10:00:00Z', version: 'v1', caller: { id: 'caller-1', name: 'Private Name', phone: 'secret' }, summary: 'Network issue' }], nextCursor: 'cursor-2', hasMore: false }; }, async getCase() { return null; } };
  const adapter = createCrmAdapter({ contract, client, store, canAccessGeography: () => true });
  const first = await adapter.syncCases({ cursor: 'cursor-1' });
  assert.equal(first.results[0].status, 'imported');
  assert.equal(first.nextCursor, 'cursor-2');
  assert.equal(store.signals[0].source.urgency, 'high');
  assert.equal(store.signals[0].source.callerReference, 'caller-1');
  assert.equal(store.signals[0].description, 'Network issue');
  assert.equal(store.signals[0].source.caller, undefined);
  const duplicate = await adapter.syncCases({ cursor: 'cursor-2' });
  assert.equal(duplicate.results[0].status, 'duplicate');
  assert.equal(store.audits.length, 1);
});

test('CRM retryable failures retry with bounded backoff and outbound updates fail closed', async () => {
  const waits = [];
  let attempts = 0;
  const client = { async listCases() { attempts += 1; const error = new Error('busy'); error.status = 503; throw error; }, async getCase() { return null; } };
  const adapter = createCrmAdapter({ contract, client, store: storeFixture(), sleep: async (ms) => waits.push(ms) });
  await assert.rejects(adapter.syncCases(), /busy/);
  assert.equal(attempts, 3);
  assert.equal(waits.length, 2);
  await assert.rejects(adapter.sendUpdate(), (error) => error.code === 'CRM_CONTRACT_MISSING');
});
