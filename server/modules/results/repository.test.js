import test from 'node:test';
import assert from 'node:assert/strict';
import { createResultsRepository } from './repository.js';

const record = {
  id: 'rr-1',
  submissionId: 'sub-1',
  payloadHash: 'hash-1',
  electionId: 'ng-oyo-election',
  scopeId: 'ng-oyo',
  geography: { state: 'Oyo', lga: 'Ibadan North', ward: 'Ward 1', pollingUnit: 'PU 1' },
  provenance: { classification: 'field-observed' },
  state: 'Oyo',
  lga: 'Ibadan North',
  ward: 'Ward 1',
  pollingUnit: 'PU 1',
  resultSource: 'Agent',
  submittedBy: 'agent-1',
  submittedByRole: 'Agent',
  resultCount: '[{"party":"A","votes":1}]',
  evidence: [{ type: 'image' }],
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
};

test('local result repository persists and lists dedicated records', async () => {
  const jsonDb = { resultRecords: [] };
  let saves = 0;
  const repository = createResultsRepository({ pool: null, jsonDb, saveJson: () => { saves += 1; }, mappers: {} });

  assert.deepEqual(await repository.createResultRecord(record), record);
  assert.deepEqual(await repository.resultRecords(), [record]);
  assert.equal(saves, 1);
});

test('postgres result repository writes JSON fields and maps the returned row', async () => {
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      return { rows: [{
        id: record.id,
        submission_id: record.submissionId,
        payload_hash: record.payloadHash,
        election_id: record.electionId,
        scope_id: record.scopeId,
        geography: record.geography,
        provenance: record.provenance,
        state: record.state,
        lga: record.lga,
        ward: record.ward,
        polling_unit: record.pollingUnit,
        result_source: record.resultSource,
        submitted_by: record.submittedBy,
        submitted_by_role: record.submittedByRole,
        result_count: record.resultCount,
        evidence: record.evidence,
        created_at: new Date(record.createdAt),
        updated_at: new Date(record.updatedAt),
        capture_time: new Date(record.createdAt),
        server_receipt_at: new Date(record.createdAt),
        record_version: '1',
      }] };
    },
  };
  const repository = createResultsRepository({ pool, jsonDb: {}, saveJson() {}, mappers: { toResultRecord: (row) => ({ id: row.id, submissionId: row.submission_id, evidence: row.evidence }) } });

  const saved = await repository.createResultRecord(record);

  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /insert into result_records/);
  assert.equal(queries[0].values[1], record.submissionId);
  assert.deepEqual(JSON.parse(queries[0].values[7]), record.geography);
  assert.deepEqual(saved, { id: record.id, submissionId: record.submissionId, evidence: record.evidence });

  // Postgres rejects the whole statement ("INSERT has more expressions than target columns")
  // when these three drift apart, and a fake pool that ignores the SQL cannot catch it.
  const [, columnList, placeholderList] = queries[0].text.match(/insert into result_records \(([^)]+)\) values \(([^)]+)\)/);
  assert.equal(placeholderList.split(',').length, columnList.split(',').length, 'placeholder count must match column count');
  assert.equal(queries[0].values.length, columnList.split(',').length, 'bound value count must match column count');
});

test('resultRecordsPage bounds the JSON-store result to a page scoped by geography', async () => {
  const jsonDb = { resultRecords: [record, { ...record, id: 'rr-2', submissionId: 'sub-2', lga: 'Atiba', geography: { ...record.geography, lga: 'Atiba' } }] };
  const repository = createResultsRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });

  const page = await repository.resultRecordsPage({ lga: 'Ibadan North' });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, 'rr-1');
});

test('resultRecordsPage runs a bounded SQL query against Postgres', async () => {
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith('select count')) return { rows: [{ count: 7 }] };
      return { rows: [] };
    },
  };
  const repository = createResultsRepository({ pool, jsonDb: {}, saveJson() {}, mappers: { toResultRecord: (row) => row } });

  const page = await repository.resultRecordsPage({ ward: 'Ward 1', limit: 10, offset: 20 });
  assert.equal(page.total, 7);
  assert.match(queries[1].text, /where ward = \$1/);
  assert.deepEqual(queries[1].values, ['Ward 1', 10, 20]);
});