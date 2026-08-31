import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminSocketRoom,
  chatSocketRoom,
  emitChatMessage,
  joinSocketToChatRooms,
  syncChatRoomSockets,
  userSocketRoom,
} from './chat-realtime.js';

test('authenticated users join their private user and chat rooms', async () => {
  const joined = [];
  const socket = { join: room => joined.push(room) };
  const user = { id: 'agent-1', role: 'Agent' };
  const store = { chatRooms: async () => [{ id: 'room-1' }, { id: 'room-2' }] };

  await joinSocketToChatRooms(socket, store, user, () => false);

  assert.deepEqual(joined, [userSocketRoom(user.id), chatSocketRoom('room-1'), chatSocketRoom('room-2')]);
  assert.ok(!joined.includes(adminSocketRoom));
});

test('admins join the admin channel and all visible chat rooms', async () => {
  const joined = [];
  const socket = { join: room => joined.push(room) };
  const user = { id: 'admin-1', role: 'Admin' };
  const store = { chatRooms: async () => [{ id: 'room-1' }] };

  await joinSocketToChatRooms(socket, store, user, () => true);

  assert.deepEqual(joined, [userSocketRoom(user.id), adminSocketRoom, chatSocketRoom('room-1')]);
});

test('new chat rooms are assigned only to admins and explicit members', () => {
  const assignments = [];
  const io = { in: source => ({ socketsJoin: target => assignments.push([source, target]) }) };

  syncChatRoomSockets(io, { id: 'room-7', members: ['agent-1', 'agent-2'] });

  assert.deepEqual(assignments, [
    [adminSocketRoom, chatSocketRoom('room-7')],
    [userSocketRoom('agent-1'), chatSocketRoom('room-7')],
    [userSocketRoom('agent-2'), chatSocketRoom('room-7')],
  ]);
});

test('chat messages emit to the private chat channel', () => {
  const emitted = [];
  const io = { to: room => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) };
  const message = { id: 'message-1', body: 'Situation normal' };

  emitChatMessage(io, 'room-9', message);

  assert.deepEqual(emitted, [{
    room: chatSocketRoom('room-9'),
    event: 'chat:message',
    payload: { roomId: 'room-9', message },
  }]);
});
