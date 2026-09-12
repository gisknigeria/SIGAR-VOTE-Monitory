import test from 'node:test';
import assert from 'node:assert/strict';
import { registerIrevIntegration } from './irev.js';

const fakeApp = () => ({ get() {}, post() {} });
const fakeStore = () => {
  const settings = new Map();
  return {
    async setting(key, fallback) { return settings.has(key) ? settings.get(key) : fallback; },
    async setSetting(key, value) { settings.set(key, value); return value; },
  };
};
const jsonResponse = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] || null },
  arrayBuffer: async () => Buffer.from(JSON.stringify(body)),
});

test('the Oyo IReV feed retries a transient failure before returning configured data', async () => {
  const electionId = 'a'.repeat(24);
  process.env.IREV_OYO_ELECTION_ID = electionId;
  try {
    let calls = 0;
    const fetchImpl = async (url) => {
      calls += 1;
      if (calls <= 2) { const error = jsonResponse(503, {}); return error; }
      if (url.includes('/result/stats')) return jsonResponse(200, { success: true, data: { documents: 0, expected: 0 } });
      return jsonResponse(200, { success: true, data: [] });
    };
    const { loadOyoIrev } = registerIrevIntegration({ app: fakeApp(), auth: () => {}, adminOnly: () => {}, rateLimit: () => {}, irevOcrRateLimit: () => {}, asyncRoute: (fn) => fn, store: fakeStore(), isAdminRole: () => false, geminiApiKeys: [], geminiVisionModel: '', callGeminiVision: async () => ({}), bundledOsunIrevArchive: null, fetchImpl });
    const data = await loadOyoIrev();
    assert.equal(data.configured, true);
    assert.ok(calls > 2, 'expected at least one retry before success');
  } finally {
    delete process.env.IREV_OYO_ELECTION_ID;
  }
});

test('the Oyo IReV feed does not retry a non-transient error and fails without a cached archive', async () => {
  const electionId = 'b'.repeat(24);
  process.env.IREV_OYO_ELECTION_ID = electionId;
  try {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return jsonResponse(400, {}); };
    const { loadOyoIrev } = registerIrevIntegration({ app: fakeApp(), auth: () => {}, adminOnly: () => {}, rateLimit: () => {}, irevOcrRateLimit: () => {}, asyncRoute: (fn) => fn, store: fakeStore(), isAdminRole: () => false, geminiApiKeys: [], geminiVisionModel: '', callGeminiVision: async () => ({}), bundledOsunIrevArchive: null, fetchImpl });
    await assert.rejects(loadOyoIrev());
    assert.equal(calls, 2, 'two endpoints are fetched in parallel, but neither retries a non-retryable status');
  } finally {
    delete process.env.IREV_OYO_ELECTION_ID;
  }
});

test('the Oyo IReV feed returns an explicit waiting state when no election id is configured, never a guessed one', async () => {
  delete process.env.IREV_OYO_ELECTION_ID;
  const { loadOyoIrev } = registerIrevIntegration({ app: fakeApp(), auth: () => {}, adminOnly: () => {}, rateLimit: () => {}, irevOcrRateLimit: () => {}, asyncRoute: (fn) => fn, store: fakeStore(), isAdminRole: () => false, geminiApiKeys: [], geminiVisionModel: '', callGeminiVision: async () => ({}), bundledOsunIrevArchive: null, fetchImpl: async () => { throw new Error('must not be called'); } });
  const data = await loadOyoIrev();
  assert.equal(data.configured, false);
  assert.match(data.notice, /not available on IReV yet/);
});
