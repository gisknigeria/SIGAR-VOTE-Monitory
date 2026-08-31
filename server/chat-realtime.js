export const chatSocketRoom = roomId => `chat:${roomId}`;
export const userSocketRoom = userId => `user:${userId}`;
export const adminSocketRoom = 'role:chat-admin';

export async function joinSocketToChatRooms(socket, store, user, isAdminRole) {
  socket.join(userSocketRoom(user.id));
  if (isAdminRole(user)) socket.join(adminSocketRoom);
  const rooms = await store.chatRooms(user);
  for (const room of rooms) socket.join(chatSocketRoom(room.id));
}

export function syncChatRoomSockets(io, room) {
  const targetRoom = chatSocketRoom(room.id);
  io.in(adminSocketRoom).socketsJoin(targetRoom);
  for (const userId of room.members || []) io.in(userSocketRoom(userId)).socketsJoin(targetRoom);
}

export function emitChatRoom(io, room) {
  syncChatRoomSockets(io, room);
  io.to(chatSocketRoom(room.id)).emit('chat:room', room);
}

export function emitChatMessage(io, roomId, message) {
  io.to(chatSocketRoom(roomId)).emit('chat:message', { roomId, message });
}

export function emitChatDeleted(io, roomId) {
  const targetRoom = chatSocketRoom(roomId);
  io.to(targetRoom).emit('chat:deleted', roomId);
  io.in(targetRoom).socketsLeave(targetRoom);
}
