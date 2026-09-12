import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncidentsRepository } from './repository.js';

const incident = (overrides) => ({ id: 'i-1', title: 'Report', status: 'reported', lga: '', ward: '', pollingUnit: '', createdAt: '2026-09-10T08:00:00.000Z', ...overrides });

test('incidentsPage bounds the JSON-store result to a page and reports the true total', async () => {
  const jsonDb = { incidents: Array.from({ length: 5 }, (_, index) => incident({ id: `i-${index}`, lga: 'Ibadan North' })) };
  const repository = createIncidentsRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });

  const page = await repository.incidentsPage({ lga: 'Ibadan North', limit: 2, offset: 1 });
  assert.equal(page.items.length, 2);
  assert.equal(page.total, 5);
  assert.equal(page.limit, 2);
  assert.equal(page.offset, 1);
});

test('incidentsPage excludes records outside the requested geography', async () => {
  const jsonDb = { incidents: [incident({ id: 'a', lga: 'Ibadan North' }), incident({ id: 'b', lga: 'Atiba' })] };
  const repository = createIncidentsRepository({ pool: null, jsonDb, saveJson() {}, mappers: {} });

  const page = await repository.incidentsPage({ lga: 'Atiba' });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, 'b');
});

test('incidentsPage caps the limit and runs a bounded SQL query against Postgres', async () => {
  const queries = [];
  const pool = {
    async query(text, values) {
      queries.push({ text, values });
      if (text.startsWith('select count')) return { rows: [{ count: 42 }] };
      return { rows: [{ id: 'pg-1' }] };
    },
  };
  const repository = createIncidentsRepository({ pool, jsonDb: {}, saveJson() {}, mappers: { toIncident: (row) => row } });

  const page = await repository.incidentsPage({ lga: 'Ibadan North', limit: 9999, offset: -5 });
  assert.equal(page.total, 42);
  assert.equal(page.limit, 200);
  assert.equal(page.offset, 0);
  assert.match(queries[1].text, /where lga = \$1/);
  assert.match(queries[1].text, /limit \$2 offset \$3/);
  assert.deepEqual(queries[1].values, ['Ibadan North', 200, 0]);
});
