import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { canManageRank, normalizeCommand, ranksBelow } from '../shared/electionData.js';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.DATA_FILE || join(__dirname, 'data.json');
const secret = process.env.JWT_SECRET || 'demo-only-change-me';
const databaseUrl = process.env.DATABASE_URL;
const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@command.local';
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Password1234';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@command.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'Password1234';
const seed = {
  users: [
    { id: 'u0', name: 'System Administrator', email: superAdminEmail, password: bcrypt.hashSync(superAdminPassword, 10), role: 'Super Admin', rank: 'Super Admin', active: true, unit: 'System Control', command: 'Oyo State Command', division: '', lga: '', lat: 7.3775, lng: 3.9470 },
    { id: 'u1', name: 'Election Operations Admin', email: adminEmail, password: bcrypt.hashSync(adminPassword, 10), role: 'Admin', rank: 'Admin', active: true, unit: 'Command Center', command: 'Oyo State Command', division: '', lga: '', lat: 7.3775, lng: 3.9470 }
  ],
  incidents: [],
  cameras: [],
  mapLayers: [],
  chatRooms: [],
  chatMembers: [],
  chatMessages: []
};

let jsonDb = existsSync(dataFile)
  ? JSON.parse(readFileSync(dataFile, 'utf8'))
  : JSON.parse(JSON.stringify(seed));
jsonDb.cameras ||= [];
jsonDb.mapLayers ||= [];
jsonDb.chatRooms ||= [];
jsonDb.chatMembers ||= [];
jsonDb.chatMessages ||= [];
jsonDb.users = jsonDb.users.filter(user => !['u0', 'u1', 'u2', 'u3'].includes(user.id));
jsonDb.users.unshift(...seed.users);
jsonDb.users = jsonDb.users.map(user => {
  if (user.role === 'Officer') return { ...user, role: 'Agent', rank: 'Agent' };
  if (user.role === 'Admin') return { ...user, rank: 'Admin', command: user.command || 'Oyo State Command' };
  return user;
});
jsonDb.incidents = jsonDb.incidents.filter(incident => !['i1', 'i2', 'i3'].includes(incident.id) && incident.createdBy !== 'seed');
const saveJson = () => writeFileSync(dataFile, JSON.stringify(jsonDb, null, 2));
if (!databaseUrl) saveJson();

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const publicUser = ({ password, ...user }) => user;
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toUser = row => row && ({ id: row.id, name: row.name, email: row.email, password: row.password, role: row.role, rank: row.rank || '', active: row.active, unit: row.unit, unitType: row.unit_type || 'Division', command: row.command || '', division: row.division || '', station: row.station || '', lga: row.lga || '', ward: row.ward || '', pollingUnit: row.polling_unit || '', lat: Number(row.lat) || 7.3775, lng: Number(row.lng) || 3.9470 });
const toIncident = row => row && ({ id: row.id, title: row.title, description: row.description, reportType: row.report_type || 'IP', severity: row.severity, status: row.status, lat: Number(row.lat), lng: Number(row.lng), assignedTo: row.assigned_to || '', visibleTo: row.visible_to || [], media: row.media || [], geometry: row.geometry || null, style: row.style || null, lga: row.lga || '', ward: row.ward || '', pollingUnit: row.polling_unit || '', resultCount: row.result_count || '', createdAt: row.created_at?.toISOString?.() || row.created_at, updatedAt: row.updated_at?.toISOString?.() || row.updated_at, createdBy: row.created_by || '' });
const toCamera = row => row && ({ id: row.id, name: row.name, type: row.type, url: row.url, lat: Number(row.lat), lng: Number(row.lng), status: row.status, createdAt: row.created_at?.toISOString?.() || row.created_at });
const toMapLayer = row => row && ({ id: row.id, name: row.name, type: row.type, data: row.data, url: row.url || '', bounds: row.bounds, opacity: Number(row.opacity ?? 0.65), fillOpacity: Number(row.fill_opacity ?? 0.18), category: row.category || (row.type === 'raster' ? 'Raster' : 'Point'), operationalUse: row.operational_use || 'Reference', color: row.color || '#facc15', fillColor: row.fill_color || '#f59e0b', lineWeight: Number(row.line_weight || 2), lineStyle: row.line_style || 'solid', pointIcon: row.point_icon || 'pin', pointIconColor: row.point_icon_color || '#ffffff', pointSize: Number(row.point_size || 24), showLabels: row.show_labels ?? true, labelField: row.label_field || 'name', popupFields: row.popup_fields || '', visible: row.visible ?? true, zIndex: Number(row.z_index || 0), createdAt: row.created_at?.toISOString?.() || row.created_at, updatedAt: row.updated_at?.toISOString?.() || row.updated_at });
const toChatRoom = row => row && ({ id: row.id, name: row.name, type: row.type || 'room', incidentId: row.incident_id || '', createdBy: row.created_by || '', createdAt: row.created_at?.toISOString?.() || row.created_at, members: row.members || [] });
const toChatMessage = row => row && ({ id: row.id, roomId: row.room_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at?.toISOString?.() || row.created_at });

async function initPostgres() {
  if (!pool) return;
  await pool.query(`
    create table if not exists users (
      id text primary key,
      name text not null,
      email text not null unique,
      password text not null,
      role text not null default 'Agent',
      rank text default '',
      active boolean not null default true,
      unit text default 'Field Unit',
      unit_type text default 'Division',
      command text default '',
      division text default '',
      station text default '',
      lga text default '',
      ward text default '',
      polling_unit text default '',
      lat double precision default 7.3775,
      lng double precision default 3.9470
    );
    create table if not exists incidents (
      id text primary key,
      title text not null,
      description text default '',
      report_type text default 'IP',
      severity text default 'High',
      status text default 'Open',
      lat double precision not null,
      lng double precision not null,
      assigned_to text default '',
      visible_to jsonb default '[]'::jsonb,
      media jsonb default '[]'::jsonb,
      geometry jsonb,
      style jsonb,
      lga text default '',
      ward text default '',
      polling_unit text default '',
      result_count text default '',
      created_at timestamptz default now(),
      updated_at timestamptz,
      created_by text default ''
    );
    create table if not exists cameras (
      id text primary key,
      name text not null,
      type text default 'CCTV',
      url text not null,
      lat double precision default 7.3775,
      lng double precision default 3.9470,
      status text default 'Online',
      created_at timestamptz default now()
    );
    create table if not exists map_layers (
      id text primary key,
      name text not null,
      type text not null,
      data jsonb,
      url text,
      bounds jsonb,
      opacity double precision default 0.65,
      fill_opacity double precision default 0.18,
      category text default 'Point',
      operational_use text default 'Reference',
      color text default '#facc15',
      fill_color text default '#f59e0b',
      line_weight double precision default 2,
      line_style text default 'solid',
      point_icon text default 'pin',
      point_icon_color text default '#ffffff',
      point_size double precision default 24,
      show_labels boolean default true,
      label_field text default 'name',
      popup_fields text default '',
      visible boolean default true,
      z_index integer default 0,
      created_at timestamptz default now(),
      updated_at timestamptz
    );
    create table if not exists chat_rooms (
      id text primary key,
      name text not null,
      type text default 'room',
      incident_id text default '',
      created_by text default '',
      created_at timestamptz default now()
    );
    create table if not exists chat_members (
      room_id text not null,
      user_id text not null,
      primary key (room_id, user_id)
    );
    create table if not exists chat_messages (
      id text primary key,
      room_id text not null,
      sender_id text not null,
      body text not null,
      created_at timestamptz default now()
    );
  `);
  await pool.query("alter table users add column if not exists rank text default ''");
  await pool.query("alter table users add column if not exists unit_type text default 'Division'");
  await pool.query("alter table users add column if not exists command text default ''");
  await pool.query("alter table users add column if not exists division text default ''");
  await pool.query("alter table users add column if not exists station text default ''");
  await pool.query("alter table users add column if not exists lga text default ''");
  await pool.query("alter table users add column if not exists ward text default ''");
  await pool.query("alter table users add column if not exists polling_unit text default ''");
  await pool.query("alter table incidents add column if not exists report_type text default 'IP'");
  await pool.query("alter table incidents add column if not exists visible_to jsonb default '[]'::jsonb");
  await pool.query("alter table incidents add column if not exists media jsonb default '[]'::jsonb");
  await pool.query("alter table incidents add column if not exists geometry jsonb");
  await pool.query("alter table incidents add column if not exists style jsonb");
  await pool.query("alter table incidents add column if not exists lga text default ''");
  await pool.query("alter table incidents add column if not exists ward text default ''");
  await pool.query("alter table incidents add column if not exists polling_unit text default ''");
  await pool.query("alter table incidents add column if not exists result_count text default ''");
  await pool.query("create unique index if not exists one_polling_result_per_unit on incidents (lower(lga), lower(ward), lower(polling_unit)) where report_type='Polling Unit Result'");
  await pool.query("alter table map_layers add column if not exists category text default 'Point'");
  await pool.query("alter table map_layers add column if not exists operational_use text default 'Reference'");
  await pool.query("alter table map_layers add column if not exists color text default '#facc15'");
  await pool.query("alter table map_layers add column if not exists fill_color text default '#f59e0b'");
  await pool.query("alter table map_layers add column if not exists fill_opacity double precision default 0.18");
  await pool.query("alter table map_layers add column if not exists line_weight double precision default 2");
  await pool.query("alter table map_layers add column if not exists line_style text default 'solid'");
  await pool.query("alter table map_layers add column if not exists point_icon text default 'pin'");
  await pool.query("alter table map_layers add column if not exists point_icon_color text default '#ffffff'");
  await pool.query("alter table map_layers add column if not exists point_size double precision default 24");
  await pool.query("alter table map_layers add column if not exists show_labels boolean default true");
  await pool.query("alter table map_layers add column if not exists label_field text default 'name'");
  await pool.query("alter table map_layers add column if not exists popup_fields text default ''");
  await pool.query("alter table map_layers add column if not exists visible boolean default true");
  await pool.query("alter table map_layers add column if not exists z_index integer default 0");
  await pool.query("alter table map_layers add column if not exists updated_at timestamptz");
  await pool.query("update users set role='Agent', rank='Agent' where role='Officer'");
  const { rows } = await pool.query('select count(*)::int as count from users');
  await pool.query("delete from incidents where id in ('i1','i2','i3') or created_by='seed'");
  await pool.query("delete from users where id in ('u2','u3')");
  for (const user of seed.users) {
    await pool.query('insert into users (id,name,email,password,role,rank,active,unit,unit_type,command,division,station,lga,lat,lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) on conflict (id) do update set name=excluded.name,email=excluded.email,password=excluded.password,role=excluded.role,rank=excluded.rank,active=excluded.active,unit=excluded.unit,command=excluded.command', [user.id, user.name, user.email, user.password, user.role, user.rank, user.active, user.unit, user.unitType || 'Division', user.command, user.division, user.station || '', user.lga, user.lat, user.lng]);
  }
}

const store = {
  async users() {
    if (!pool) return jsonDb.users;
    const { rows } = await pool.query('select * from users order by role, name');
    return rows.map(toUser);
  },
  async userByEmail(email) {
    if (!pool) return jsonDb.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.active);
    const { rows } = await pool.query('select * from users where lower(email)=lower($1) and active=true limit 1', [email]);
    return toUser(rows[0]);
  },
  async createUser(user) {
    if (!pool) { jsonDb.users.push(user); saveJson(); return user; }
    const { rows } = await pool.query('insert into users (id,name,email,password,role,rank,active,unit,unit_type,command,division,station,lga,ward,polling_unit,lat,lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning *', [user.id, user.name, user.email, user.password, user.role, user.rank, user.active, user.unit, user.unitType || 'Division', user.command, user.division, user.station || '', user.lga, user.ward || '', user.pollingUnit || '', user.lat, user.lng]);
    return toUser(rows[0]);
  },
  async updateUserPassword(id, password) {
    if (!pool) {
      const user = jsonDb.users.find(item => item.id === id);
      if (!user) return null;
      user.password = password;
      saveJson();
      return user;
    }
    const { rows } = await pool.query('update users set password=$2 where id=$1 returning *', [id, password]);
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
      const index = jsonDb.incidents.findIndex(i => i.id === id);
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
    if (!pool) { jsonDb.incidents = jsonDb.incidents.filter(i => i.id !== id); saveJson(); return; }
    await pool.query('delete from incidents where id=$1', [id]);
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
    const { rows } = await pool.query('insert into map_layers (id,name,type,data,url,bounds,opacity,fill_opacity,category,operational_use,color,fill_color,line_weight,line_style,point_icon,point_icon_color,point_size,show_labels,label_field,popup_fields,visible,z_index,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) returning *', [layer.id, layer.name, layer.type, layer.data || null, layer.url || null, layer.bounds || null, layer.opacity, layer.fillOpacity ?? 0.18, layer.category, layer.operationalUse || 'Reference', layer.color, layer.fillColor, layer.lineWeight || 2, layer.lineStyle || 'solid', layer.pointIcon || 'pin', layer.pointIconColor || '#ffffff', layer.pointSize || 24, layer.showLabels, layer.labelField, layer.popupFields || '', layer.visible, layer.zIndex, layer.createdAt]);
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
    const { rows } = await pool.query('update map_layers set name=$2, opacity=$3, fill_opacity=$4, category=$5, operational_use=$6, color=$7, fill_color=$8, line_weight=$9, line_style=$10, point_icon=$11, point_icon_color=$12, point_size=$13, show_labels=$14, label_field=$15, popup_fields=$16, visible=$17, z_index=$18, updated_at=$19 where id=$1 returning *', [id, merged.name, merged.opacity, merged.fillOpacity, merged.category, merged.operationalUse, merged.color, merged.fillColor, merged.lineWeight, merged.lineStyle, merged.pointIcon, merged.pointIconColor, merged.pointSize, merged.showLabels, merged.labelField, merged.popupFields, merged.visible, merged.zIndex, merged.updatedAt]);
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
    const { rows } = await pool.query('insert into chat_messages (id,room_id,sender_id,body,created_at) values ($1,$2,$3,$4,$5) returning *', [message.id, message.roomId, message.senderId, message.body, message.createdAt]);
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
    if (!room) {
      room = await this.createChatRoom({ id: roomId, name: `Incident ${incident.id}: ${incident.title}`, type: 'incident', incidentId: incident.id, createdBy: viewer.id, createdAt: new Date().toISOString() }, members);
    } else {
      for (const userId of members) room = await this.addChatMember(roomId, userId);
    }
    return room;
  }
};

await initPostgres();

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const activeCameraShares = new Map();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
const auth = (req, res, next) => { try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), secret); next(); } catch { res.status(401).json({ message: 'Session expired. Please sign in again.' }); } };
const isAdminRole = user => ['Admin', 'Super Admin'].includes(user?.role);
const adminOnly = (req, res, next) => isAdminRole(req.user) ? next() : res.status(403).json({ message: 'Admin access required' });
const superAdminOnly = (req, res, next) => req.user.role === 'Super Admin' ? next() : res.status(403).json({ message: 'System administrator access required' });
const canManageUsers = user => user?.role === 'Super Admin' || user?.role === 'Admin';
const visibleUsersFor = (viewer, users) => {
  const visibleUsers = users.filter(user => user.id !== viewer.id && user.role !== 'Super Admin');
  if (isAdminRole(viewer)) return visibleUsers;
  if (viewer.role === 'Supervisor') return visibleUsers.filter(user => user.role === 'Agent' && normalizeKey(user.lga) === normalizeKey(viewer.lga) && normalizeKey(user.ward) === normalizeKey(viewer.ward));
  if (viewer.role === 'Agent') return [];
  return visibleUsers.filter(user => canManageRank(viewer.rank, user.rank));
};
const canCreateUser = (viewer, rank, role) => {
  if (viewer.role === 'Super Admin') return ['Agent', 'Supervisor', 'Response Team', 'Admin'].includes(role);
  if (viewer.role === 'Admin') return ['Agent', 'Supervisor', 'Response Team'].includes(role);
  return false;
};
const canDeleteUser = (viewer, target) => {
  if (!target || target.id === viewer.id) return false;
  if (viewer.role === 'Super Admin') return true;
  if (viewer.role === 'Admin') return target.role !== 'Super Admin' && target.role !== 'Admin';
  return canManageRank(viewer.rank, target.rank);
};
const canAccessRoom = (viewer, room) => !!room && (isAdminRole(viewer) || room.members?.includes(viewer.id));
const isSosIncident = incident => incident?.reportType === 'SOS-Emergency' || incident?.style?.source === 'sos';
const sameZone = (viewer, incident) => !!viewer?.lga && !!viewer?.ward && normalizeKey(viewer.lga) === normalizeKey(incident?.lga) && normalizeKey(viewer.ward) === normalizeKey(incident?.ward);
const canAccessIncident = (viewer, incident) => isAdminRole(viewer) || (viewer?.role === 'Supervisor' && sameZone(viewer, incident)) || incident.createdBy === viewer.id || incident.assignedTo === viewer.id || (incident.visibleTo || []).includes(viewer.id);
const normalizeKey = value => String(value || '').trim().toLowerCase();
const normalizeCommandKey = value => normalizeCommand(value || '').toLowerCase();
const userIdOf = user => user?.userId || user?.id;
const distanceMeters = (a, b) => {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const toRad = degrees => degrees * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const startLat = toRad(lat1);
  const endLat = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const isControlRoomUser = user => isAdminRole(user) || normalizeKey(user?.unit).includes('control room');
const sameOperationalSpace = (sender, receiver) => {
  if (!userIdOf(sender) || userIdOf(sender) === userIdOf(receiver)) return false;
  const senderUnitType = normalizeKey(sender.unitType || sender.unit || sender.role);
  if (senderUnitType.includes('station')) {
    return !!normalizeKey(sender.station || sender.unit) && normalizeKey(sender.station || sender.unit) === normalizeKey(receiver.station || receiver.unit);
  }
  if (senderUnitType.includes('division')) {
    return !!normalizeKey(sender.division || sender.unit) && normalizeKey(sender.division || sender.unit) === normalizeKey(receiver.division || receiver.unit);
  }
  return !!normalizeCommandKey(sender.command || sender.unit) && normalizeCommandKey(sender.command || sender.unit) === normalizeCommandKey(receiver.command || receiver.unit);
};
const sosVisibleTo = alert => {
  const ids = new Set();
  for (const socket of io.sockets.sockets.values()) {
    const user = socket.data.user;
    const id = userIdOf(user);
    if (!id || id === userIdOf(alert) || isControlRoomUser(user)) continue;
    const local = user.role === 'Supervisor' ? sameZone(user, alert) : sameOperationalSpace(alert, user);
    const nearby = user.role !== 'Supervisor' && distanceMeters(alert, user) <= 5000;
    if (local || nearby) ids.add(id);
  }
  return [...ids];
};
const emitEmergencyAlert = (sourceSocket, alert) => {
  const normalized = { ...alert, id: alert.id || `em-${Date.now()}`, timestamp: alert.timestamp || new Date().toISOString() };
  for (const socket of io.sockets.sockets.values()) {
    if (socket.id === sourceSocket.id) continue;
    const user = socket.data.user;
    if (!user?.userId) continue;
    const controlRoom = isControlRoomUser(user);
    const localResponder = user.role === 'Supervisor' ? sameZone(user, normalized) : sameOperationalSpace(normalized, user);
    const nearbyResponder = !controlRoom && user.role !== 'Supervisor' && distanceMeters(normalized, user) <= 5000;
    if (controlRoom || localResponder || nearbyResponder) {
      socket.emit('emergency:alert', { ...normalized, silent: controlRoom });
    }
  }
};

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'Election Monitoring Command API', database: pool ? 'neon-postgres' : 'json-file' }));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const user = await store.userByEmail(String(req.body.email || ''));
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return res.status(401).json({ message: 'Invalid email or password' });
  const safe = publicUser(user);
  res.json({ token: jwt.sign(safe, secret, { expiresIn: '8h' }), user: safe });
}));
app.get('/api/users', auth, asyncRoute(async (req, res) => res.json(visibleUsersFor(req.user, await store.users()).map(publicUser))));
app.get('/api/report-viewers', auth, asyncRoute(async (req, res) => res.json(visibleUsersFor(req.user, await store.users()).map(publicUser))));
app.post('/api/users', auth, asyncRoute(async (req, res) => {
  if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = req.body.role || 'Agent';
  const rank = String(req.body.rank || '').trim();
  if (!req.body.name || !email || !req.body.password) return res.status(400).json({ message: 'Name, email and password are required' });
  if (!rank) return res.status(400).json({ message: 'Rank is required' });
  if (!canCreateUser(req.user, rank, role)) return res.status(403).json({ message: 'You can only create accounts below your rank' });
  if ((await store.users()).some(user => user.email.toLowerCase() === email)) return res.status(409).json({ message: 'An account with that email already exists' });
  const user = {
    id: `u${Date.now()}`,
    name: String(req.body.name).trim(), email,
    password: await bcrypt.hash(req.body.password, 10),
    role, rank: role,
    active: true,
    unit: req.body.unit || 'Field Unit',
    unitType: String(req.body.unitType || 'Division').trim(),
    command: String(req.body.command || '').trim(),
    division: String(req.body.division || '').trim(),
    station: String(req.body.station || '').trim(),
    lga: String(req.body.lga || '').trim(),
    ward: String(req.body.ward || '').trim(),
    pollingUnit: String(req.body.pollingUnit || '').trim(),
    lat: Number(req.body.lat) || 7.3775,
    lng: Number(req.body.lng) || 3.9470
  };
  const created = await store.createUser(user);
  io.emit('user:created', publicUser(created));
  res.status(201).json(publicUser(created));
}));
app.delete('/api/users/:id', auth, asyncRoute(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account' });
  const target = (await store.users()).find(user => user.id === req.params.id);
  if (!canDeleteUser(req.user, target)) return res.status(403).json({ message: 'You are not allowed to delete this account' });
  const deleted = await store.deleteUser(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Personnel account not found' });
  io.emit('user:deleted', req.params.id);
  res.status(204).end();
}));
app.put('/api/users/:id/password', auth, asyncRoute(async (req, res) => {
  const target = (await store.users()).find(user => user.id === req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (req.user.id !== target.id && req.user.role !== 'Super Admin' && !canManageRank(req.user.rank, target.rank)) return res.status(403).json({ message: 'You can only change passwords for lower ranks' });
  const password = String(req.body.password || '');
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  await store.updateUserPassword(req.params.id, await bcrypt.hash(password, 10));
  res.json({ ok: true });
}));
app.get('/api/incidents', auth, asyncRoute(async (req, res) => res.json((await store.incidents()).filter(incident => canAccessIncident(req.user, incident)))));
app.post('/api/incidents', auth, asyncRoute(async (req, res) => {
  const media = Array.isArray(req.body.media) ? req.body.media.slice(0, 6) : [];
  const mediaBytes = media.reduce((total, item) => total + Buffer.byteLength(String(item?.data || ''), 'utf8'), 0);
  if (mediaBytes > 14 * 1024 * 1024) return res.status(413).json({ message: 'Incident attachments are too large. Keep the total under 10MB.' });
  const isResult = req.body.reportType === 'Polling Unit Result';
  const allowedTypes = new Set(['Polling Unit Result', 'SOS-Emergency', 'Vote Buying', 'Thuggery and Violence', 'Voter Intimidation', 'Collusion', 'Compromised Privacy', 'Over-voting', 'Late Opening', 'Material Shortages', 'Missing Registers', 'Lack of Crowd Control', 'BVAS Failure', 'Network Connectivity', 'Battery Depletion']);
  if (['Agent', 'Supervisor'].includes(req.user.role) && !allowedTypes.has(req.body.reportType)) return res.status(403).json({ message: 'This role cannot create that report type' });
  const lga = String(req.user.lga || req.body.lga || '').trim();
  const ward = String(req.user.ward || req.body.ward || '').trim();
  const pollingUnit = String((req.user.role === 'Agent' ? req.user.pollingUnit : req.body.pollingUnit) || '').trim();
  if (isResult) {
    if (!lga || !ward || !pollingUnit) return res.status(400).json({ message: 'An assigned LGA, ward and polling unit are required' });
    if (!String(req.body.resultCount || '').trim()) return res.status(400).json({ message: 'Result counts are required' });
    if (!media.some(item => item?.type === 'image')) return res.status(400).json({ message: 'A photograph of the signed result is required' });
    const duplicate = (await store.incidents()).find(item => item.reportType === 'Polling Unit Result' && normalizeKey(item.lga) === normalizeKey(lga) && normalizeKey(item.ward) === normalizeKey(ward) && normalizeKey(item.pollingUnit) === normalizeKey(pollingUnit));
    if (duplicate) return res.status(409).json({ message: 'A result has already been submitted for this polling unit. Contact an administrator to correct it.' });
  }
  const visibleTo = [...new Set([
    ...(Array.isArray(req.body.visibleTo) ? req.body.visibleTo : []),
    ...(isSosIncident(req.body) ? sosVisibleTo({ ...req.user, userId: req.user.id, ...req.body }) : []),
    req.body.assignedTo
  ].filter(Boolean))];
  const incident = { ...req.body, lga, ward, pollingUnit, visibleTo, media, id: `i${Date.now()}`, createdAt: new Date().toISOString(), createdBy: req.user.id };
  const created = await store.createIncident(incident);
  io.emit('incident:created', created);
  res.status(201).json(created);
}));
app.put('/api/incidents/:id', auth, asyncRoute(async (req, res) => {
  const current = (await store.incidents()).find(item => item.id === req.params.id);
  if (!current || !canAccessIncident(req.user, current)) return res.status(404).json({ message: 'Incident not found' });
  const incident = await store.updateIncident(req.params.id, req.body);
  if (!incident) return res.status(404).json({ message: 'Incident not found' });
  io.emit('incident:updated', incident);
  res.json(incident);
}));
app.delete('/api/incidents/:id', auth, adminOnly, asyncRoute(async (req, res) => { await store.deleteIncident(req.params.id); io.emit('incident:deleted', req.params.id); res.status(204).end(); }));
app.post('/api/incidents/:id/chat', auth, asyncRoute(async (req, res) => {
  const incident = (await store.incidents()).find(item => item.id === req.params.id);
  if (!incident) return res.status(404).json({ message: 'Incident not found' });
  if (!canAccessIncident(req.user, incident)) return res.status(403).json({ message: 'Only assigned viewers and command can open this incident chat' });
  const room = await store.incidentChatRoom(incident, req.user);
  io.emit('chat:room', room);
  res.json(room);
}));
app.get('/api/cameras', auth, asyncRoute(async (_, res) => res.json(await store.cameras())));
app.post('/api/cameras', auth, adminOnly, asyncRoute(async (req, res) => {
  if (!req.body.name || !req.body.url) return res.status(400).json({ message: 'Camera name and stream URL are required' });
  const camera = { id: `cam-${Date.now()}`, name: req.body.name, type: req.body.type || 'CCTV', url: req.body.url, lat: Number(req.body.lat) || 7.3775, lng: Number(req.body.lng) || 3.9470, status: 'Online', createdAt: new Date().toISOString() };
  const created = await store.createCamera(camera);
  io.emit('camera:created', created);
  res.status(201).json(created);
}));
app.delete('/api/cameras/:id', auth, adminOnly, asyncRoute(async (req, res) => { await store.deleteCamera(req.params.id); io.emit('camera:deleted', req.params.id); res.status(204).end(); }));
app.get('/api/map-layers', auth, asyncRoute(async (_, res) => res.json(await store.mapLayers())));
app.post('/api/map-layers', auth, superAdminOnly, asyncRoute(async (req, res) => {
  if (!req.body.name || !req.body.type) return res.status(400).json({ message: 'Layer name and type are required' });
  const layer = { id: `layer-${Date.now()}`, name: String(req.body.name).trim(), type: req.body.type, data: req.body.data || null, url: req.body.url || '', bounds: req.body.bounds || null, opacity: Number(req.body.opacity) || 0.65, fillOpacity: Number(req.body.fillOpacity ?? 0.18), category: req.body.category || (req.body.type === 'raster' ? 'Raster' : 'Point'), operationalUse: req.body.operationalUse || 'Reference', color: req.body.color || '#facc15', fillColor: req.body.fillColor || req.body.color || '#f59e0b', lineWeight: Number(req.body.lineWeight) || 2, lineStyle: req.body.lineStyle || 'solid', pointIcon: req.body.pointIcon || 'pin', pointIconColor: req.body.pointIconColor || '#ffffff', pointSize: Number(req.body.pointSize) || 24, showLabels: req.body.showLabels ?? true, labelField: req.body.labelField || 'name', popupFields: req.body.popupFields || '', visible: req.body.visible ?? true, zIndex: Number(req.body.zIndex) || 0, createdAt: new Date().toISOString() };
  const created = await store.createMapLayer(layer);
  io.emit('map-layer:created', created);
  res.status(201).json(created);
}));
app.put('/api/map-layers/:id', auth, asyncRoute(async (req, res) => {
  const allowedKeys = isAdminRole(req.user) ? ['visible', 'opacity', 'fillOpacity', 'color', 'fillColor', 'lineWeight', 'lineStyle', 'pointIcon', 'pointIconColor', 'pointSize', 'showLabels', 'labelField', 'popupFields', 'category', 'operationalUse', 'name', 'zIndex'] : ['visible'];
  const changes = {};
  for (const key of allowedKeys) {
    if (req.body[key] === undefined) continue;
    changes[key] = ['opacity', 'fillOpacity', 'lineWeight', 'pointSize', 'zIndex'].includes(key) ? Number(req.body[key]) : req.body[key];
  }
  if (!Object.keys(changes).length) return res.status(400).json({ message: 'No permitted layer changes supplied' });
  const updated = await store.updateMapLayer(req.params.id, changes);
  if (!updated) return res.status(404).json({ message: 'Map layer not found' });
  io.emit('map-layer:updated', updated);
  res.json(updated);
}));
app.delete('/api/map-layers/:id', auth, superAdminOnly, asyncRoute(async (req, res) => { await store.deleteMapLayer(req.params.id); io.emit('map-layer:deleted', req.params.id); res.status(204).end(); }));
app.get('/api/chat/rooms', auth, asyncRoute(async (req, res) => res.json(await store.chatRooms(req.user))));
app.post('/api/chat/rooms', auth, asyncRoute(async (req, res) => {
  if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Room name is required' });
  const allowedUsers = visibleUsersFor(req.user, await store.users());
  const allowedIds = new Set(allowedUsers.map(user => user.id));
  const memberIds = (Array.isArray(req.body.memberIds) ? req.body.memberIds : [req.body.userId]).filter(id => id && allowedIds.has(id));
  const room = await store.createChatRoom({ id: `room-${Date.now()}`, name, type: 'room', incidentId: '', createdBy: req.user.id, createdAt: new Date().toISOString() }, memberIds);
  io.emit('chat:room', room);
  res.status(201).json(room);
}));
app.post('/api/chat/rooms/:id/members', auth, asyncRoute(async (req, res) => {
  if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
  const room = await store.chatRoom(req.params.id);
  if (!room) return res.status(404).json({ message: 'Chat room not found' });
  const target = (await store.users()).find(user => user.id === req.body.userId);
  if (!target || !visibleUsersFor(req.user, [target]).length) return res.status(403).json({ message: 'You cannot add this user to the chat' });
  const updated = await store.addChatMember(req.params.id, target.id);
  io.emit('chat:room', updated);
  res.json(updated);
}));
app.delete('/api/chat/rooms/:id', auth, asyncRoute(async (req, res) => {
  if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
  const room = await store.chatRoom(req.params.id);
  if (!room) return res.status(404).json({ message: 'Chat room not found' });
  const deleted = await store.deleteChatRoom(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Chat room not found' });
  io.emit('chat:deleted', req.params.id);
  res.status(204).end();
}));
app.get('/api/chat/rooms/:id/messages', auth, asyncRoute(async (req, res) => {
  const room = await store.chatRoom(req.params.id);
  if (!canAccessRoom(req.user, room)) return res.status(403).json({ message: 'You cannot view this chat' });
  res.json(await store.chatMessages(req.params.id));
}));
app.post('/api/chat/rooms/:id/messages', auth, asyncRoute(async (req, res) => {
  const room = await store.chatRoom(req.params.id);
  if (!canAccessRoom(req.user, room)) return res.status(403).json({ message: 'You cannot send to this chat' });
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ message: 'Message cannot be empty' });
  const message = await store.createChatMessage({ id: `msg-${Date.now()}`, roomId: req.params.id, senderId: req.user.id, body, createdAt: new Date().toISOString() });
  io.emit('chat:message', { roomId: req.params.id, message });
  res.status(201).json(message);
}));
app.post('/api/gps/ping', auth, (req, res) => {
  const point = { ...req.body, userId: req.user.id, timestamp: new Date().toISOString() };
  io.emit('gps:broadcast', point);
  res.json({ received: true });
});
io.use((socket, next) => {
  try {
    socket.data.authUser = jwt.verify(socket.handshake.auth?.token || '', secret);
    next();
  } catch {
    next(new Error('Unauthorized realtime connection'));
  }
});
io.on('connection', socket => {
  socket.data.user = { ...socket.data.authUser, userId: socket.data.authUser.id };
  socket.on('gps:update', point => {
    const safePoint = { ...point, userId: socket.data.authUser.id, lat: Number(point.lat), lng: Number(point.lng), timestamp: point.timestamp || new Date().toISOString() };
    socket.data.user = { ...(socket.data.user || {}), userId: safePoint.userId, lat: safePoint.lat, lng: safePoint.lng };
    io.emit('gps:broadcast', safePoint);
  });
  socket.on('gps:stop', () => io.emit('gps:offline', { userId: socket.data.authUser.id, timestamp: new Date().toISOString() }));
  socket.on('emergency:send', alert => emitEmergencyAlert(socket, { ...alert, ...(socket.data.user || {}), userId: socket.data.authUser.id, name: socket.data.authUser.name, role: socket.data.authUser.role }));
  socket.on('camera:register', user => { const safeUser = { ...user, userId: socket.data.authUser.id, name: socket.data.authUser.name, role: socket.data.authUser.role }; socket.data.cameraUser = { userId: safeUser.userId, name: safeUser.name, role: safeUser.role }; socket.data.user = { ...(socket.data.user || {}), ...safeUser, lat: Number(safeUser.lat), lng: Number(safeUser.lng) }; socket.join(`camera:user:${safeUser.userId}`); if (isAdminRole(safeUser)) socket.emit('camera:shares:list', [...activeCameraShares.values()]); });
  socket.on('camera:share:start', payload => { const safePayload = { ...payload, userId: socket.data.authUser.id, name: socket.data.authUser.name }; activeCameraShares.set(safePayload.userId, safePayload); socket.broadcast.emit('camera:share:start', safePayload); });
  socket.on('camera:share:stop', () => { const userId = socket.data.authUser.id; activeCameraShares.delete(userId); socket.broadcast.emit('camera:share:stop', { userId }); });
  socket.on('camera:view:request', ({ officerId }) => io.to(`camera:user:${officerId}`).emit('camera:viewer:request', { viewerSocketId: socket.id }));
  socket.on('camera:signal', ({ target, data }) => io.to(target).emit('camera:signal', { from: socket.id, fromUserId: socket.data.cameraUser?.userId, fromName: socket.data.cameraUser?.name, data }));
  socket.on('disconnect', () => { const user = socket.data.cameraUser; if (['Agent', 'Supervisor', 'Response Team'].includes(user?.role) && activeCameraShares.has(user.userId)) { activeCameraShares.delete(user.userId); socket.broadcast.emit('camera:share:stop', { userId: user.userId }); } });
});

app.use((err, _, res, __) => {
  console.error(err);
  res.status(500).json({ message: 'Server error. Please check logs.' });
});

if (process.env.NODE_ENV === 'production') { app.use(express.static(join(__dirname, '..', 'dist'))); app.get(/.*/, (_, res) => res.sendFile(join(__dirname, '..', 'dist', 'index.html'))); }
server.listen(process.env.PORT || 5000, '0.0.0.0', () => console.log(`Election Monitoring Command API listening on port ${process.env.PORT || 5000}`));
