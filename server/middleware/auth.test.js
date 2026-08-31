import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from './auth.js';

const asyncRoute = handler => handler;
const publicUser = ({ password, ...user }) => user;

test('password changes invalidate previously issued sessions', async () => {
  const user = { id: 'user-1', name: 'Agent', password: 'first-password-hash', active: true };
  const store = { users: async () => [user] };
  const auth = createAuth({ secret: 'a-secure-test-secret-that-is-over-32-bytes', store, publicUser, asyncRoute });
  const token = auth.issueToken(user);

  assert.equal((await auth.authenticateToken(token)).id, user.id);
  user.password = 'changed-password-hash';
  await assert.rejects(() => auth.authenticateToken(token), /Invalid session/);
});
