import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAuth } from './media-auth.js';

test('media tokens are short-lived and scoped to camera mode and geography', () => {
  const media = createMediaAuth({ secret: 'media-secret-for-tests', canAccessGeography: (user, geography) => user.lga === geography.lga });
  const user = { id: 'agent-1', role: 'Agent', lga: 'Ibadan North' };
  const token = media.issueMediaToken({ user, cameraId: 'cam-1', mode: 'view', geography: { lga: 'Ibadan North' }, ttlSeconds: 60 });
  const claims = media.verifyMediaToken(token);
  assert.equal(claims.sub, 'agent-1');
  assert.deepEqual(claims.scope, ['camera:cam-1:view']);
  assert.throws(() => media.issueMediaToken({ user, cameraId: 'cam-1', mode: 'publish', geography: { lga: 'Ibadan South' } }), /not authorized/);
});

test('media callbacks use an HMAC signature', () => {
  const media = createMediaAuth({ secret: 'media-secret-for-tests', canAccessGeography: () => true });
  const signed = media.signCallback({ event: 'recording.processing', id: 'recording-1' });
  assert.equal(media.verifyCallback(signed.body, signed.signature), true);
  assert.equal(media.verifyCallback(`${signed.body}x`, signed.signature), false);
});