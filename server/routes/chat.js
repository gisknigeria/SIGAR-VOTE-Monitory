import { Router } from 'express';
import { emitChatDeleted, emitChatMessage, emitChatRoom } from '../chat-realtime.js';

const allowedAttachmentMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

export function createChatRouter({
  auth,
  rateLimit,
  asyncRoute,
  store,
  io,
  canManageUsers,
  visibleUsersFor,
  canAccessRoom,
  isAdminRole,
  createId,
  normalizeText,
  sanitizeString,
  emitNotification,
}) {
  const router = Router();

  router.get('/rooms', auth, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.chatRooms(req.user));
  }));

  router.post('/rooms', auth, rateLimit, asyncRoute(async (req, res) => {
    if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
    const name = sanitizeString(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Room name is required' });
    const allowedUsers = visibleUsersFor(req.user, await store.users());
    const allowedIds = new Set(allowedUsers.map(user => user.id));
    const memberIds = (Array.isArray(req.body.memberIds) ? req.body.memberIds : [req.body.userId]).filter(id => id && allowedIds.has(id));
    const room = await store.createChatRoom({ id: createId('room'), name, type: 'room', incidentId: '', createdBy: req.user.id, createdAt: new Date().toISOString() }, memberIds);
    emitChatRoom(io, room);
    res.status(201).json(room);
  }));

  router.post('/rooms/:id/members', auth, rateLimit, asyncRoute(async (req, res) => {
    if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
    const room = await store.chatRoom(req.params.id);
    if (!room) return res.status(404).json({ message: 'Chat room not found' });
    const target = (await store.users()).find(user => user.id === req.body.userId);
    if (!target || !visibleUsersFor(req.user, [target]).length) return res.status(403).json({ message: 'You cannot add this user to the chat' });
    const updated = await store.addChatMember(req.params.id, target.id);
    emitChatRoom(io, updated);
    res.json(updated);
  }));

  router.delete('/rooms/:id', auth, rateLimit, asyncRoute(async (req, res) => {
    if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
    const room = await store.chatRoom(req.params.id);
    if (!room) return res.status(404).json({ message: 'Chat room not found' });
    const deleted = await store.deleteChatRoom(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Chat room not found' });
    emitChatDeleted(io, req.params.id);
    res.status(204).end();
  }));

  router.get('/rooms/:id/messages', auth, rateLimit, asyncRoute(async (req, res) => {
    const room = await store.chatRoom(req.params.id);
    if (!canAccessRoom(req.user, room)) return res.status(403).json({ message: 'You cannot view this chat' });
    res.json(await store.chatMessages(req.params.id));
  }));

  router.post('/rooms/:id/messages', auth, rateLimit, asyncRoute(async (req, res) => {
    const room = await store.chatRoom(req.params.id);
    if (!canAccessRoom(req.user, room)) return res.status(403).json({ message: 'You cannot send to this chat' });
    const body = normalizeText(req.body.body || '').trim();
    const attachments = (Array.isArray(req.body.attachments) ? req.body.attachments : []).slice(0, 3).map(item => ({
      type: sanitizeString(item?.type || '').toLowerCase(),
      name: sanitizeString(item?.name || 'attachment').slice(0, 180),
      mimeType: sanitizeString(item?.mimeType || '').slice(0, 120),
      size: Math.max(0, Number(item?.size) || 0),
      data: String(item?.data || ''),
    }));
    const totalBytes = attachments.reduce((sum, item) => sum + item.size, 0);
    const invalidAttachment = attachments.some(item => !['image', 'video', 'document'].includes(item.type)
      || !allowedAttachmentMimeTypes.has(item.mimeType)
      || item.size > 5 * 1024 * 1024
      || !item.data.startsWith(`data:${item.mimeType};base64,`));
    if (invalidAttachment) return res.status(400).json({ message: 'Unsupported or oversized chat attachment' });
    if (totalBytes > 7 * 1024 * 1024) return res.status(413).json({ message: 'Chat attachments must be 7 MB or smaller in total' });
    if (!body && !attachments.length) return res.status(400).json({ message: 'Enter a message or attach evidence' });

    const message = await store.createChatMessage({ id: createId('msg'), roomId: req.params.id, senderId: req.user.id, body, attachments, createdAt: new Date().toISOString() });
    emitChatMessage(io, req.params.id, message);
    if (isAdminRole(req.user)) {
      for (const userId of (room.members || []).filter(id => id !== req.user.id)) {
        const notification = await store.createNotification({ id: createId('notif'), userId, incidentId: room.incidentId || '', roomId: room.id, senderId: req.user.id, message: body || `Sent ${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`, incidentType: 'Message from command', read: false, createdAt: message.createdAt });
        emitNotification(notification);
      }
    }
    res.status(201).json(message);
  }));

  return router;
}
