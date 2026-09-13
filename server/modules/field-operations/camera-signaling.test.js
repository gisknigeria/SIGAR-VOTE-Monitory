import test from 'node:test';
import assert from 'node:assert/strict';
import { registerFieldRealtime } from './realtime.js';

test('camera signals authorize the admin viewer in both directions and reject agent peers', async () => {
  const users = { admin: { id: 'admin', role: 'Admin' }, agent: { id: 'agent', role: 'Agent', ward: '1' }, other: { id: 'other', role: 'Agent' } };
  const sockets = new Map();
  const delivered = [];
  let connect;
  const io = { use() {}, on(event, handler) { connect = handler; }, sockets: { sockets }, to(target) { return { emit(event, payload) { delivered.push({ target, event, payload }); } }; } };
  registerFieldRealtime({ app: { post() {} }, io, store: { chatRooms: async () => [] }, socketLimiter: { hit: () => ({ allowed: true }) }, authenticateToken: async token => users[token], activeCameraShares: new Map(), isAdminRole: user => user.role === 'Admin', canAccessUserGeography: (viewer) => viewer.role === 'Admin' });
  for (const [id, user] of Object.entries(users)) {
    const handlers = {};
    const socket = { id, data: { authUser: user }, handshake: { auth: { token: id } }, join() {}, emit() {}, on(event, handler) { handlers[event] = handler; }, handlers };
    sockets.set(id, socket);
    await connect(socket);
  }
  await sockets.get('agent').handlers['camera:signal']({ target: 'admin', data: { sdp: { type: 'offer' } } });
  await sockets.get('admin').handlers['camera:signal']({ target: 'agent', data: { sdp: { type: 'answer' } } });
  await sockets.get('agent').handlers['camera:signal']({ target: 'other', data: { candidate: {} } });
  assert.deepEqual(delivered.map(item => item.target), ['admin', 'agent']);
  assert.equal(delivered[0].payload.fromUserId, 'agent');
});
