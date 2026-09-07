import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAreaOperationsRouter, validateOperation } from './routes/area-operations.js';
import { createStore } from './store.js';
import { adminOnly } from './middleware/auth.js';
import { getRegistrationLocationOptions } from '../shared/electionData.js';

const lga = getRegistrationLocationOptions('Oyo').lgas[0];
const valid = { title: 'Observer training', category: 'Training', lga, ward: '', date: '2026-10-10', notes: 'Check venue access.' };
test('operation validation rejects bad geography, dates, and categories', () => {
  assert.equal(validateOperation(valid).lga, lga);
  assert.throws(() => validateOperation({ ...valid, ward: 'Unknown ward' }));
  assert.throws(() => validateOperation({ ...valid, date: '2026-02-30' }));
  assert.throws(() => validateOperation({ ...valid, category: 'Unknown' }));
});

test('admin API persists individual plans, protects counts, and removes only the requested plan', async t => {
  const db = { settings: { unrelated: { preserved: true } }, users: [{ id: 'a', role: 'Agent', state: 'Oyo', active: true, lga, ward: '', pollingUnit: '' }] };
  const store = createStore({ pool: null, jsonDb: db, saveJson: () => {}, mappers: {} });
  const app = express(); app.use(express.json());
  const auth = (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.sendStatus(401);
    req.user = { id: 'test-admin', role }; next();
  };
  const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  app.use('/operations', createAreaOperationsRouter({ auth, adminOnly, rateLimit: (_req, _res, next) => next(), asyncRoute, store }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/operations`;
  const headers = { 'Content-Type': 'application/json', 'x-test-role': 'Admin' };
  assert.equal((await fetch(`${url}/agents`)).status, 401);
  for (const [path, method] of [['agents', 'GET'], ['plans', 'GET'], ['plans', 'POST'], ['plans/00000000-0000-0000-0000-000000000000', 'DELETE']]) {
    assert.equal((await fetch(`${url}/${path}`, { method, headers: { ...headers, 'x-test-role': 'Agent' } })).status, 403);
  }
  assert.equal((await (await fetch(`${url}/agents`, { headers })).json()).total, 1);
  assert.equal((await fetch(`${url}/plans`, { method: 'POST', headers, body: JSON.stringify({ ...valid, lga: 'Invalid' }) })).status, 400);
  const response = await fetch(`${url}/plans`, { method: 'POST', headers, body: JSON.stringify(valid) });
  assert.equal(response.status, 201);
  const plan = await response.json();
  const reloadedStore = createStore({ pool: null, jsonDb: db, saveJson: () => {}, mappers: {} });
  assert.equal((await reloadedStore.operationPlans())[0].id, plan.id);
  assert.equal((await (await fetch(`${url}/plans`, { headers })).json()).length, 1);
  assert.equal((await fetch(`${url}/plans/${plan.id}`, { method: 'DELETE', headers })).status, 204);
  assert.equal((await store.operationPlans()).length, 0);
  assert.deepEqual(db.settings.unrelated, { preserved: true });
});
