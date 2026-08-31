const isAdminRole = user => ['Super Admin', 'Admin'].includes(user?.role);

export function createStore({ pool, jsonDb, saveJson, mappers }) {
  const { toUser, toIncident, toNotification, toCamera, toMapLayer, toChatRoom, toChatMessage } = mappers;

  return {
    async setting(key, fallback = null) {
      if (!pool) return Object.prototype.hasOwnProperty.call(jsonDb.settings || {}, key) ? jsonDb.settings[key] : fallback;
      const { rows } = await pool.query('select value from app_settings where key=$1', [key]);
      return rows[0]?.value ?? fallback;
    },
    async setSetting(key, value) {
      if (!pool) { jsonDb.settings ||= {}; jsonDb.settings[key] = value; saveJson(); return value; }
      await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [key, JSON.stringify(value)]);
      return value;
    },
    async parties() {
      if (!pool) return jsonDb.parties || [];
      const { rows } = await pool.query("select value from app_settings where key='political_parties'");
      return rows[0]?.value || [];
    },
    async setParties(parties) {
      if (!pool) { jsonDb.parties = parties; saveJson(); return parties; }
      await pool.query("insert into app_settings (key,value) values ('political_parties',$1) on conflict (key) do update set value=excluded.value", [JSON.stringify(parties)]);
      return parties;
    },
    async users() {
      if (!pool) return jsonDb.users;
      const { rows } = await pool.query('select * from users order by role, name');
      return rows.map(toUser);
    },
    async userByEmail(email) {
      if (!pool) return jsonDb.users.find(user => user.email.toLowerCase() === email.toLowerCase() && user.active);
      const { rows } = await pool.query('select * from users where lower(email)=lower($1) and active=true limit 1', [email]);
      return toUser(rows[0]);
    },
    async createUser(user) {
      if (!pool) { jsonDb.users.push(user); saveJson(); return user; }
      const { rows } = await pool.query('insert into users (id,name,email,password,role,rank,active,unit,unit_type,command,division,station,state,lga,ward,polling_unit,lat,lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning *', [user.id, user.name, user.email, user.password, user.role, user.rank, user.active, user.unit, user.unitType || 'Division', user.command, user.division, user.station || '', user.state || '', user.lga, user.ward || '', user.pollingUnit || '', user.lat, user.lng]);
      return toUser(rows[0]);
    },
    async updateUserPassword(id, password) {
      if (!pool) { const user = jsonDb.users.find(item => item.id === id); if (!user) return null; user.password = password; saveJson(); return user; }
      const { rows } = await pool.query('update users set password=$2 where id=$1 returning *', [id, password]);
      return toUser(rows[0]);
    },
    async updateUserProfile(id, changes) {
      if (!pool) { const user = jsonDb.users.find(item => item.id === id); if (!user) return null; Object.assign(user, changes); saveJson(); return user; }
      const { rows } = await pool.query('update users set name=$2,email=$3,station=$4,password=coalesce($5,password) where id=$1 returning *', [id, changes.name, changes.email, changes.station, changes.password || null]);
      return toUser(rows[0]);
    },
    async updateUser(id, changes) {
      if (!pool) { const user = jsonDb.users.find(item => item.id === id); if (!user) return null; Object.assign(user, changes); saveJson(); return user; }
      const keyMap = { unitType: 'unit_type', pollingUnit: 'polling_unit' };
      const columns = [];
      const values = [id];
      let parameter = 2;
      for (const [key, value] of Object.entries(changes)) {
        if (key === 'id' || key === 'password') continue;
        columns.push(`${keyMap[key] || key}=$${parameter}`);
        values.push(value);
        parameter += 1;
      }
      if (!columns.length) return toUser((await pool.query('select * from users where id=$1', [id])).rows[0]);
      const { rows } = await pool.query(`update users set ${columns.join(', ')} where id=$1 returning *`, values);
      return toUser(rows[0]);
    },
    async deleteUser(id) {
      if (!pool) {
        const before = jsonDb.users.length;
        jsonDb.users = jsonDb.users.filter(user => user.id !== id);
        jsonDb.incidents = jsonDb.incidents.map(incident => incident.assignedTo === id ? { ...incident, assignedTo: '' } : incident);
        saveJson();
        return jsonDb.users.length !== before;
      }
      const { rowCount } = await pool.query('delete from users where id=$1', [id]);
      await pool.query("update incidents set assigned_to='' where assigned_to=$1", [id]);
      return rowCount > 0;
    },
    async incidents() {
      if (!pool) return jsonDb.incidents;
      const { rows } = await pool.query('select * from incidents order by created_at desc');
      return rows.map(toIncident);
    },
    async createIncident(incident) {
      if (!pool) { jsonDb.incidents.unshift(incident); saveJson(); return incident; }
      const { rows } = await pool.query('insert into incidents (id,title,description,report_type,severity,status,lat,lng,assigned_to,visible_to,media,geometry,style,lga,ward,polling_unit,result_count,created_at,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning *', [incident.id, incident.title, incident.description, incident.reportType, incident.severity, incident.status, incident.lat, incident.lng, incident.assignedTo, JSON.stringify(incident.visibleTo || []), JSON.stringify(incident.media || []), JSON.stringify(incident.geometry || null), JSON.stringify(incident.style || null), incident.lga || '', incident.ward || '', incident.pollingUnit || '', incident.resultCount || '', incident.createdAt, incident.createdBy]);
      return toIncident(rows[0]);
    },
    async updateIncident(id, patch) {
      if (!pool) {
        const index = jsonDb.incidents.findIndex(incident => incident.id === id);
        if (index < 0) return null;
        jsonDb.incidents[index] = { ...jsonDb.incidents[index], ...patch, id, updatedAt: new Date().toISOString() };
        saveJson();
        return jsonDb.incidents[index];
      }
      const current = await pool.query('select * from incidents where id=$1', [id]);
      if (!current.rows[0]) return null;
      const merged = { ...toIncident(current.rows[0]), ...patch, id, updatedAt: new Date().toISOString() };
      const { rows } = await pool.query('update incidents set title=$2, description=$3, report_type=$4, severity=$5, status=$6, lat=$7, lng=$8, assigned_to=$9, visible_to=$10, media=$11, geometry=$12, style=$13, updated_at=$14 where id=$1 returning *', [id, merged.title, merged.description, merged.reportType, merged.severity, merged.status, merged.lat, merged.lng, merged.assignedTo, JSON.stringify(merged.visibleTo || []), JSON.stringify(merged.media || []), JSON.stringify(merged.geometry || null), JSON.stringify(merged.style || null), merged.updatedAt]);
      return toIncident(rows[0]);
    },
    async deleteIncident(id) {
      if (!pool) { jsonDb.incidents = jsonDb.incidents.filter(incident => incident.id !== id); saveJson(); return; }
      await pool.query('delete from incidents where id=$1', [id]);
    },
    async notifications(userId) {
      if (!pool) return (jsonDb.notifications || []).filter(item => item.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { rows } = await pool.query('select * from notifications where user_id=$1 order by created_at desc', [userId]);
      return rows.map(toNotification);
    },
    async createNotification(notification) {
      if (!pool) { jsonDb.notifications ||= []; jsonDb.notifications.push(notification); saveJson(); return notification; }
      const { rows } = await pool.query('insert into notifications (id,user_id,incident_id,room_id,sender_id,message,incident_type,read,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *', [notification.id, notification.userId, notification.incidentId || '', notification.roomId || '', notification.senderId || '', notification.message, notification.incidentType || '', false, notification.createdAt]);
      return toNotification(rows[0]);
    },
    async markNotificationAsRead(id) {
      if (!pool) { const item = (jsonDb.notifications || []).find(notification => notification.id === id); if (item) { item.read = true; saveJson(); } return item; }
      const { rows } = await pool.query('update notifications set read=true where id=$1 returning *', [id]);
      return toNotification(rows[0]);
    },
    async deleteNotification(id) {
      if (!pool) { jsonDb.notifications = (jsonDb.notifications || []).filter(item => item.id !== id); saveJson(); return; }
      await pool.query('delete from notifications where id=$1', [id]);
    },
    async cameras() {
      if (!pool) return jsonDb.cameras;
      const { rows } = await pool.query('select * from cameras order by created_at desc');
      return rows.map(toCamera);
    },
    async createCamera(camera) {
      if (!pool) { jsonDb.cameras.push(camera); saveJson(); return camera; }
      const { rows } = await pool.query('insert into cameras (id,name,type,url,lat,lng,status,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *', [camera.id, camera.name, camera.type, camera.url, camera.lat, camera.lng, camera.status, camera.createdAt]);
      return toCamera(rows[0]);
    },
    async deleteCamera(id) {
      if (!pool) { jsonDb.cameras = jsonDb.cameras.filter(camera => camera.id !== id); saveJson(); return; }
      await pool.query('delete from cameras where id=$1', [id]);
    },
    async mapLayers() {
      if (!pool) return jsonDb.mapLayers || [];
      const { rows } = await pool.query('select * from map_layers order by created_at desc');
      return rows.map(toMapLayer);
    },
    async createMapLayer(layer) {
      if (!pool) { jsonDb.mapLayers ||= []; jsonDb.mapLayers.unshift(layer); saveJson(); return layer; }
      const { rows } = await pool.query('insert into map_layers (id,name,type,data,url,bounds,opacity,fill_opacity,category,operational_use,color,fill_color,line_weight,line_style,point_icon,point_icon_color,point_size,show_labels,label_field,label_color,popup_fields,visible,z_index,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) returning *', [layer.id, layer.name, layer.type, layer.data || null, layer.url || null, layer.bounds || null, layer.opacity, layer.fillOpacity ?? 0.18, layer.category, layer.operationalUse || 'Reference', layer.color, layer.fillColor, layer.lineWeight || 2, layer.lineStyle || 'solid', layer.pointIcon || 'pin', layer.pointIconColor || '#ffffff', layer.pointSize ?? 2, layer.showLabels, layer.labelField, layer.labelColor || '#3f0b1b', layer.popupFields || '', layer.visible, layer.zIndex, layer.createdAt]);
      return toMapLayer(rows[0]);
    },
    async updateMapLayer(id, changes) {
      if (!pool) {
        const index = (jsonDb.mapLayers || []).findIndex(layer => layer.id === id);
        if (index < 0) return null;
        jsonDb.mapLayers[index] = { ...jsonDb.mapLayers[index], ...changes, updatedAt: new Date().toISOString() };
        saveJson();
        return jsonDb.mapLayers[index];
      }
      const current = await pool.query('select * from map_layers where id=$1', [id]);
      if (!current.rows[0]) return null;
      const merged = { ...toMapLayer(current.rows[0]), ...changes, updatedAt: new Date().toISOString() };
      const { rows } = await pool.query('update map_layers set name=$2, opacity=$3, fill_opacity=$4, category=$5, operational_use=$6, color=$7, fill_color=$8, line_weight=$9, line_style=$10, point_icon=$11, point_icon_color=$12, point_size=$13, show_labels=$14, label_field=$15, label_color=$16, popup_fields=$17, visible=$18, z_index=$19, updated_at=$20 where id=$1 returning *', [id, merged.name, merged.opacity, merged.fillOpacity, merged.category, merged.operationalUse, merged.color, merged.fillColor, merged.lineWeight, merged.lineStyle, merged.pointIcon, merged.pointIconColor, merged.pointSize, merged.showLabels, merged.labelField, merged.labelColor, merged.popupFields, merged.visible, merged.zIndex, merged.updatedAt]);
      return toMapLayer(rows[0]);
    },
    async deleteMapLayer(id) {
      if (!pool) { jsonDb.mapLayers = (jsonDb.mapLayers || []).filter(layer => layer.id !== id); saveJson(); return; }
      await pool.query('delete from map_layers where id=$1', [id]);
    },
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
