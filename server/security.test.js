import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeString, validatePassword, validateMediaPayload } from './security.js';

test('sanitizeString removes control characters and trims input', () => {
  assert.equal(sanitizeString('  Hello\nWorld  '), 'Hello World');
  assert.equal(sanitizeString('  '), '');
});

test('validatePassword enforces a minimum strength', () => {
  assert.equal(validatePassword('weak'), false);
  assert.equal(validatePassword('StrongPass123!'), true);
});

test('validateMediaPayload rejects oversized or invalid media input', () => {
  assert.equal(validateMediaPayload([{ type: 'image', data: 'data:image/png;base64,abc' }]).valid, true);
  assert.equal(validateMediaPayload([{ type: 'image', data: 'not-a-data-url' }]).valid, false);
  assert.equal(validateMediaPayload([{ type: 'video', mimeType: 'video/webm;codecs=vp8,opus', data: 'data:video/webm;base64,YWJj' }]).valid, true);
  assert.equal(validateMediaPayload([{ type: 'video', mimeType: 'video/mp4', data: 'data:video/webm;base64,YWJj' }]).valid, false);
  const oversizedPayload = Buffer.from('a'.repeat(13 * 1024 * 1024)).toString('base64');
  assert.equal(validateMediaPayload([{ type: 'image', data: 'data:image/png;base64,' + oversizedPayload }]).valid, false);
});
