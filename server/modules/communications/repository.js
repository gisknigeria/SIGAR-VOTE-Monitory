import { isAdminRole } from "../../middleware/auth.js";

export function createCommunicationsRepository({ pool, jsonDb, saveJson, mappers }) {
  const { toChatRoom, toChatMessage } = mappers;
  return {
    async chatRooms(viewer) {
      if (!pool) {
        const rooms = isAdminRole(viewer) ? jsonDb.chatRooms : jsonDb.chatRooms.filter(room => jsonDb.chatMembers.some(member => member.roomId === room.id && member.userId === viewer.id));
        return rooms.map(room => ({ ...room, members: jsonDb.chatMembers.filter(member => member.roomId === room.id).map(member => member.userId) }));
      }
      const query = isAdminRole(viewer)
        ? 'select r.*, coalesce(array_agg(m.user_id) filter (where m.user_id is not null), array[]::text[]) as members from chat_rooms r left join chat_members m on m.room_id=r.id group by r.id order by r.created_at desc'
        : 'select r.*, coalesce(array_agg(m.user_id) filter (where m.user_id is not null), array[]::text[]) as members from chat_rooms r join chat_members own on own.room_id=r.id and own.user_id=$1 left join chat_members m on m.room_id=r.id group by r.id order by r.created_at desc';
      const { rows } = await pool.query(query, isAdminRole(viewer) ? [] : [viewer.id]);
      return rows.map(toChatRoom);
    },
    async chatRoom(id) {
      if (!pool) {
        const room = jsonDb.chatRooms.find(item => item.id === id);
        return room && { ...room, members: jsonDb.chatMembers.filter(member => member.roomId === id).map(member => member.userId) };
      }
      const { rows } = await pool.query('select r.*, coalesce(array_agg(m.user_id) filter (where m.user_id is not null), array[]::text[]) as members from chat_rooms r left join chat_members m on m.room_id=r.id where r.id=$1 group by r.id', [id]);
      return toChatRoom(rows[0]);
    },
    async createChatRoom(room, memberIds = []) {
      const uniqueMembers = [...new Set([room.createdBy, ...memberIds].filter(Boolean))];
      if (!pool) {
        jsonDb.chatRooms.unshift(room);
        uniqueMembers.forEach(userId => jsonDb.chatMembers.push({ roomId: room.id, userId }));
        saveJson();
        return { ...room, members: uniqueMembers };
      }
      const { rows } = await pool.query('insert into chat_rooms (id,name,type,incident_id,created_by,created_at) values ($1,$2,$3,$4,$5,$6) returning *', [room.id, room.name, room.type, room.incidentId || '', room.createdBy, room.createdAt]);
      for (const userId of uniqueMembers) await pool.query('insert into chat_members (room_id,user_id) values ($1,$2) on conflict do nothing', [room.id, userId]);
      return { ...toChatRoom(rows[0]), members: uniqueMembers };
    },
    async addChatMember(roomId, userId) {
      if (!pool) {
        if (!jsonDb.chatMembers.some(member => member.roomId === roomId && member.userId === userId)) jsonDb.chatMembers.push({ roomId, userId });
        saveJson();
        return this.chatRoom(roomId);
      }
      await pool.query('insert into chat_members (room_id,user_id) values ($1,$2) on conflict do nothing', [roomId, userId]);
      return this.chatRoom(roomId);
    },
    async chatMessages(roomId) {
      if (!pool) return jsonDb.chatMessages.filter(message => message.roomId === roomId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const { rows } = await pool.query('select * from chat_messages where room_id=$1 order by created_at asc', [roomId]);
      return rows.map(toChatMessage);
    },
    async createChatMessage(message) {
      if (!pool) { jsonDb.chatMessages.push(message); saveJson(); return message; }
      const { rows } = await pool.query('insert into chat_messages (id,room_id,sender_id,body,attachments,created_at) values ($1,$2,$3,$4,$5,$6) returning *', [message.id, message.roomId, message.senderId, message.body, JSON.stringify(message.attachments || []), message.createdAt]);
      return toChatMessage(rows[0]);
    },
    async deleteChatRoom(roomId) {
      if (!pool) {
        const before = jsonDb.chatRooms.length;
        jsonDb.chatRooms = jsonDb.chatRooms.filter(room => room.id !== roomId);
        jsonDb.chatMembers = jsonDb.chatMembers.filter(member => member.roomId !== roomId);
        jsonDb.chatMessages = jsonDb.chatMessages.filter(message => message.roomId !== roomId);
        saveJson();
        return jsonDb.chatRooms.length !== before;
      }
      await pool.query('delete from chat_messages where room_id=$1', [roomId]);
      await pool.query('delete from chat_members where room_id=$1', [roomId]);
      const { rowCount } = await pool.query('delete from chat_rooms where id=$1', [roomId]);
      return rowCount > 0;
    },
    async incidentChatRoom(incident, viewer) {
      const roomId = `incident-${incident.id}`;
      let room = await this.chatRoom(roomId);
      const members = [viewer.id, incident.assignedTo].filter(Boolean);
      if (!room) room = await this.createChatRoom({ id: roomId, name: `Incident ${incident.id}: ${incident.title}`, type: 'incident', incidentId: incident.id, createdBy: viewer.id, createdAt: new Date().toISOString() }, members);
      else for (const userId of members) room = await this.addChatMember(roomId, userId);
      return room;
    },
  };
}
