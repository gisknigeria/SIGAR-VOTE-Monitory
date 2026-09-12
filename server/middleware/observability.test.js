import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, requestId } from './observability.js';

test('redact removes known-sensitive keys at any depth without dropping other fields', () => {
  const input = { name: 'Agent One', password: 'secret123', nested: { token: 'abc', ok: true }, list: [{ apiKey: 'x', keep: 1 }] };
  const output = redact(input);
  assert.equal(output.name, 'Agent One');
  assert.equal(output.password, '[redacted]');
  assert.equal(output.nested.token, '[redacted]');
  assert.equal(output.nested.ok, true);
  assert.equal(output.list[0].apiKey, '[redacted]');
  assert.equal(output.list[0].keep, 1);
});

test('redact is case-insensitive on key names and leaves primitives untouched', () => {
  assert.equal(redact({ Authorization: 'Bearer x' }).Authorization, '[redacted]');
  assert.equal(redact('plain string'), 'plain string');
  assert.equal(redact(42), 42);
  assert.equal(redact(null), null);
});

test('requestId middleware assigns a new id, echoes it as a response header, and accepts a valid caller-supplied id', () => {
  const middleware = requestId();
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; } };
  let called = false;

  const reqNoHeader = { headers: {} };
  middleware(reqNoHeader, res, () => { called = true; });
  assert.ok(called);
  assert.ok(reqNoHeader.id);
  assert.equal(headers['X-Request-Id'], reqNoHeader.id);

  const reqWithHeader = { headers: { 'x-request-id': 'client-supplied-id-123' } };
  middleware(reqWithHeader, res, () => {});
  assert.equal(reqWithHeader.id, 'client-supplied-id-123');
});

test('requestId middleware ignores an invalid caller-supplied id rather than trusting arbitrary input', () => {
  const middleware = requestId();
  const res = { setHeader: () => {} };
  const req = { headers: { 'x-request-id': '<script>not-an-id</script>' } };
  middleware(req, res, () => {});
  assert.notEqual(req.id, '<script>not-an-id</script>');
});
