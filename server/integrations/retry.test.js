import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWithRetry } from './retry.js';

const statusError = (status) => { const error = new Error(`status ${status}`); error.status = status; return error; };
const noopSleep = async () => {};

test('retries a retryable status until it succeeds and reports attempt count', async () => {
  let calls = 0;
  const result = await requestWithRetry(async (attempt) => {
    calls += 1;
    if (attempt < 3) throw statusError(503);
    return `ok-${attempt}`;
  }, { sleep: noopSleep });
  assert.equal(result, 'ok-3');
  assert.equal(calls, 3);
});

test('does not retry a non-retryable status', async () => {
  let calls = 0;
  await assert.rejects(requestWithRetry(async () => { calls += 1; throw statusError(400); }, { sleep: noopSleep }), /status 400/);
  assert.equal(calls, 1);
});

test('gives up after the attempt limit and surfaces the last error', async () => {
  let calls = 0;
  await assert.rejects(requestWithRetry(async () => { calls += 1; throw statusError(429); }, { attempts: 2, sleep: noopSleep }), /status 429/);
  assert.equal(calls, 2);
});

test('honors a provider-supplied retryAfterMs instead of the default backoff', async () => {
  const waits = [];
  const sleep = async (ms) => { waits.push(ms); };
  let calls = 0;
  await requestWithRetry(async () => {
    calls += 1;
    if (calls === 1) { const error = statusError(429); error.retryAfterMs = 1234; throw error; }
    return 'done';
  }, { sleep });
  assert.deepEqual(waits, [1234]);
});

test('a network error with no status is not treated as retryable by default', async () => {
  let calls = 0;
  await assert.rejects(requestWithRetry(async () => { calls += 1; throw new Error('ECONNRESET'); }, { sleep: noopSleep }), /ECONNRESET/);
  assert.equal(calls, 1);
});
