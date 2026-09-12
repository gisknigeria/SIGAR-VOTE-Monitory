import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeocodingClient } from './geocoding.js';

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('reverseLocation retries a transient failure and returns the eventual result', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 2) return jsonResponse(503, {});
    return jsonResponse(200, { display_name: 'Ibadan, Oyo, Nigeria' });
  };
  const { reverseLocation } = createGeocodingClient({ fetchImpl });
  const result = await reverseLocation(7.3775, 3.947);
  assert.equal(calls, 2);
  assert.ok(result.label);
});

test('reverseLocation does not retry a non-transient client error', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return jsonResponse(400, {}); };
  const { reverseLocation } = createGeocodingClient({ fetchImpl });
  await assert.rejects(reverseLocation(7.3775, 3.947), /Address lookup returned 400/);
  assert.equal(calls, 1);
});

test('reverseLocation caches a successful lookup and does not call fetch again for the same coordinates', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return jsonResponse(200, { display_name: 'Ibadan, Oyo, Nigeria' }); };
  const { reverseLocation } = createGeocodingClient({ fetchImpl });
  await reverseLocation(7.1, 3.2);
  await reverseLocation(7.1, 3.2);
  assert.equal(calls, 1);
});
