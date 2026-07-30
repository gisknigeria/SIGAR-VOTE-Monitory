import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { canManageRank, normalizeCommand, ranksBelow } from '../shared/electionData.js';
import { credentialFingerprint, createId, createRateLimitState, normalizeText, sanitizeString, validateContentLength, validateCoordinates, validateEmail, validateExternalUrl, validateMediaPayload, validatePassword } from './security.js';
import { analyzeContextLocally, summarizeNewsLocally } from './ai.js';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.DATA_FILE || join(__dirname, 'data.json');
const secret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Using a generated ephemeral secret for this process.');
}
const databaseUrl = process.env.DATABASE_URL;
const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@command.local';
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || randomBytes(24).toString('hex');
const adminEmail = process.env.ADMIN_EMAIL || 'admin@command.local';
const adminPassword = process.env.ADMIN_PASSWORD || randomBytes(24).toString('hex');
if (!process.env.SUPER_ADMIN_PASSWORD || !process.env.ADMIN_PASSWORD) {
  console.warn('SUPER_ADMIN_PASSWORD and ADMIN_PASSWORD were not set. Generated secure random passwords for the seeded admin accounts.');
}
if (process.env.NODE_ENV === 'production') {
  const missing = ['JWT_SECRET', 'SUPER_ADMIN_PASSWORD', 'ADMIN_PASSWORD'].filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  if (Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) throw new Error('JWT_SECRET must contain at least 32 bytes');
  if (!validatePassword(process.env.SUPER_ADMIN_PASSWORD) || !validatePassword(process.env.ADMIN_PASSWORD)) throw new Error('Seed administrator passwords do not meet the password policy');
}
const seed = {
  users: [
    { id: 'u0', name: 'System Administrator', email: superAdminEmail, password: bcrypt.hashSync(superAdminPassword, 10), role: 'Super Admin', rank: 'Super Admin', active: true, unit: 'System Control', command: 'Oyo State Command', division: '', state: 'Oyo', lga: '', lat: 7.3775, lng: 3.9470 },
    { id: 'u1', name: 'Election Operations Admin', email: adminEmail, password: bcrypt.hashSync(adminPassword, 10), role: 'Admin', rank: 'Admin', active: true, unit: 'Command Center', command: 'Oyo State Command', division: '', state: 'Oyo', lga: '', lat: 7.3775, lng: 3.9470 }
  ],
  incidents: [],
  cameras: [],
  mapLayers: [],
  chatRooms: [],
  chatMembers: [],
  chatMessages: [],
  parties: []
};

let jsonDb = existsSync(dataFile)
  ? JSON.parse(readFileSync(dataFile, 'utf8'))
  : JSON.parse(JSON.stringify(seed));
jsonDb.cameras ||= [];
jsonDb.mapLayers ||= [];
jsonDb.chatRooms ||= [];
jsonDb.chatMembers ||= [];
jsonDb.chatMessages ||= [];
jsonDb.parties ||= [];
const existingSeedUsers = new Map(jsonDb.users.filter(user => ['u0', 'u1'].includes(user.id)).map(user => [user.id, user]));
jsonDb.users = jsonDb.users.filter(user => !['u0', 'u1', 'u2', 'u3'].includes(user.id));
jsonDb.users.unshift(...seed.users.map(user => {
  const existing = existingSeedUsers.get(user.id);
  return existing ? { ...user, ...existing, password: existing.password } : user;
}));
jsonDb.users = jsonDb.users.map(user => {
  if (user.role === 'Officer') return { ...user, role: 'Agent', rank: 'Agent' };
  if (user.role === 'Admin') return { ...user, rank: 'Admin', command: user.command || 'Oyo State Command' };
  return user;
});
jsonDb.incidents = jsonDb.incidents.filter(incident => !['i1', 'i2', 'i3'].includes(incident.id) && incident.createdBy !== 'seed');
const saveJson = () => writeFileSync(dataFile, JSON.stringify(jsonDb, null, 2));
if (!databaseUrl) saveJson();

const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: true },
  max: Math.max(1, Math.min(Number(process.env.DATABASE_POOL_SIZE) || 10, 20)),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 15_000,
}) : null;
const publicUser = ({ password, ...user }) => user;
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toUser = row => row && ({ id: row.id, name: row.name, email: row.email, password: row.password, role: row.role, rank: row.rank || '', active: row.active, unit: row.unit, unitType: row.unit_type || 'Division', command: row.command || '', division: row.division || '', station: row.station || '', state: row.state || '', lga: row.lga || '', ward: row.ward || '', pollingUnit: row.polling_unit || '', lat: Number(row.lat) || 7.3775, lng: Number(row.lng) || 3.9470 });
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
      state text default '',
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
    create table if not exists app_settings (key text primary key, value jsonb not null default '[]'::jsonb);
  `);
  await pool.query("alter table users add column if not exists rank text default ''");
  await pool.query("alter table users add column if not exists unit_type text default 'Division'");
  await pool.query("alter table users add column if not exists command text default ''");
  await pool.query("alter table users add column if not exists division text default ''");
  await pool.query("alter table users add column if not exists station text default ''");
  await pool.query("alter table users add column if not exists state text default ''");
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
  await pool.query("drop index if exists one_polling_result_per_unit");
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
    await pool.query('insert into users (id,name,email,password,role,rank,active,unit,unit_type,command,division,station,lga,lat,lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) on conflict (id) do update set name=excluded.name,email=excluded.email,role=excluded.role,rank=excluded.rank,active=excluded.active,unit=excluded.unit,command=excluded.command', [user.id, user.name, user.email, user.password, user.role, user.rank, user.active, user.unit, user.unitType || 'Division', user.command, user.division, user.station || '', user.lga, user.lat, user.lng]);
  }
}

const store = {
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
    if (!pool) return jsonDb.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.active);
    const { rows } = await pool.query('select * from users where lower(email)=lower($1) and active=true limit 1', [email]);
    return toUser(rows[0]);
  },
  async createUser(user) {
    if (!pool) { jsonDb.users.push(user); saveJson(); return user; }
    const { rows } = await pool.query('insert into users (id,name,email,password,role,rank,active,unit,unit_type,command,division,station,state,lga,ward,polling_unit,lat,lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning *', [user.id, user.name, user.email, user.password, user.role, user.rank, user.active, user.unit, user.unitType || 'Division', user.command, user.division, user.station || '', user.state || '', user.lga, user.ward || '', user.pollingUnit || '', user.lat, user.lng]);
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
  async updateUserProfile(id, changes) {
    if (!pool) { const user = jsonDb.users.find(item => item.id === id); if (!user) return null; Object.assign(user, changes); saveJson(); return user; }
    const { rows } = await pool.query('update users set name=$2,email=$3,station=$4,password=coalesce($5,password) where id=$1 returning *', [id, changes.name, changes.email, changes.station, changes.password || null]);
    return toUser(rows[0]);
  },
  async updateUser(id, changes) {
    if (!pool) {
      const user = jsonDb.users.find(item => item.id === id);
      if (!user) return null;
      Object.assign(user, changes);
      saveJson();
      return user;
    }
    const keyMap = {
      unitType: 'unit_type',
      pollingUnit: 'polling_unit',
    };
    const columns = [];
    const values = [id];
    let idx = 2;
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'id' || key === 'password') continue;
      const column = keyMap[key] || key;
      columns.push(`${column}=$${idx}`);
      values.push(value);
      idx += 1;
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
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:5173').split(',').map(value => value.trim()).filter(Boolean);
const isAllowedOrigin = (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin));
const io = new Server(server, {
  cors: { origin: isAllowedOrigin, credentials: true },
  maxHttpBufferSize: 1_000_000,
  perMessageDeflate: false,
});
const activeCameraShares = new Map();
const loginLimiter = createRateLimitState();
const generalLimiter = createRateLimitState();
const socketLimiter = createRateLimitState();
const openAiPrimaryModel = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
const openAiFallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-5.6-luna';
const groqPrimaryModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const groqFallbackModel = process.env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b';
const groqNewsModel = process.env.GROQ_NEWS_MODEL || 'groq/compound-mini';
const callGroq = async (prompt, model) => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_completion_tokens: 700,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Groq request failed');
    error.status = response.status;
    throw error;
  }
  return body.choices?.[0]?.message?.content || '';
};
const callGroqWithFallback = async (prompt) => {
  try {
    return { text: await callGroq(prompt, groqPrimaryModel), model: groqPrimaryModel };
  } catch (primaryError) {
    console.error('[groq] primary failed:', primaryError.status || '', primaryError.message);
    return { text: await callGroq(prompt, groqFallbackModel), model: groqFallbackModel };
  }
};
const normalizeNewsTitle = (value, articleUrl = '') => {
  const normalized = sanitizeString(String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]{2,})([a-z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/:\s*/g, ': ')
    .replace(/\s*[-–—]\s*/g, ' — '));
  if ((normalized.match(/\s/g) || []).length < 2 && articleUrl) {
    try {
      const parts = new URL(articleUrl).pathname.split('/').filter(Boolean);
      const slug = decodeURIComponent(parts.at(-1) || '')
        .replace(/\.(?:html?|ece|php|aspx?)$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\d{7,}\b.*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if ((slug.match(/\s/g) || []).length >= 2 && /[A-Za-z]/.test(slug)) {
        return sanitizeString(slug.charAt(0).toUpperCase() + slug.slice(1));
      }
    } catch {
      // Keep the provider title when its URL is opaque or malformed.
    }
  }
  return normalized;
};
const normalizeNewsDate = value => { const raw = String(value || '').trim(); const compact = raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/); const date = compact ? new Date(Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]), Number(compact[4] || 0), Number(compact[5] || 0), Number(compact[6] || 0))) : new Date(raw); return Number.isNaN(date.getTime()) ? '' : date.toISOString(); };
const isOyoStateNews = value => {
  const text = String(value || '');
  const isHotelCompany = /\boyo[\s\-–—]*parent\b|\boyo[\s\-–—]*hotels?\b|\bhospitality\b|\bhotels?\b|\bprism\b|\bipo\b|\brooms?\b/i.test(text);
  if (isHotelCompany) return false;
  if (/\boyo state\b|\bibadan\b/i.test(text)) return true;
  const hasBareOyo = /\boyo\b/i.test(text);
  const hasLocalContext = /\bnigeria(?:n)?\b|\binec\b|\bmakinde\b|\bgovern(?:or|ment|ance)\b|\bstate assembly\b|\bcommissioner\b|\bpolice\b|\bsecurity\b|\bcp\b|\blga\b|\blocal government\b|\bmonarchs?\b|\bresidents?\b|\bpolitic(?:s|al)?\b|\belections?\b|\bapc\b|\bpdp\b|\blabour party\b/i.test(text);
  return hasBareOyo && hasLocalContext;
};

// In-memory IP log — stores last 500 entries (incident + SOS submissions)
const ipLog = [];
const MAX_IP_LOG = 500;
const getClientIp = req =>
  req.ip ||
  req.socket?.remoteAddress ||
  'unknown';
const logIp = (type, user, incidentId, ip) => {
  ipLog.unshift({ type, userId: user.id, userName: user.name, userRole: user.role, incidentId, ip, timestamp: new Date().toISOString() });
  if (ipLog.length > MAX_IP_LOG) ipLog.length = MAX_IP_LOG;
};

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(cors({ origin: isAllowedOrigin, credentials: true, allowedHeaders: ['Content-Type', 'Authorization'], methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], maxAge: 600 }));
// Keep the parser limit aligned with the attachment policy.  This prevents
// oversized JSON from consuming memory before endpoint-level validation runs.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((req, res, next) => {
  const bodySize = Number(req.headers['content-length'] || 0);
  if (bodySize > 12 * 1024 * 1024) return res.status(413).json({ message: 'Request body is too large.' });
  if (!validateContentLength(bodySize)) return res.status(413).json({ message: 'Request body is too large.' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // These capabilities are core application features; scope them to this
  // origin rather than disabling them or allowing cross-origin use.
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=(self)');
  if (req.secure || process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org ws: wss:; font-src 'self' data:; media-src 'self' data: https:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', req.path.startsWith('/api') ? 'no-store' : 'no-cache');
  next();
});
const tokenOptions = { algorithms: ['HS256'], issuer: 'election-monitor-api', audience: 'election-monitor-web' };
const sessionTtl = process.env.SESSION_TTL || '30d';
const sessionCookieMaxAge = Math.max(3600, Number(process.env.SESSION_COOKIE_MAX_AGE) || 30 * 24 * 60 * 60);
const issueToken = user => jwt.sign(
  { sub: user.id, fp: credentialFingerprint(user.password) },
  secret,
  { algorithm: 'HS256', issuer: tokenOptions.issuer, audience: tokenOptions.audience, expiresIn: sessionTtl, jwtid: createId('jwt') },
);
const sessionCookie = token => `__Host-session=${encodeURIComponent(token)}; Path=/; Max-Age=${sessionCookieMaxAge}; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
const clearSessionCookie = '__Host-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict';
const cookieValue = (req, name) => String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1);
const authenticateToken = async token => {
  const claims = jwt.verify(token, secret, tokenOptions);
  const user = (await store.users()).find(candidate => candidate.id === claims.sub);
  if (!user || !user.active || claims.fp !== credentialFingerprint(user.password)) throw new Error('Invalid session');
  return publicUser(user);
};
const auth = asyncRoute(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : cookieValue(req, '__Host-session');
  if (!token) return res.status(401).json({ message: 'Authentication required.' });
  try {
    req.user = await authenticateToken(token);
    next();
  } catch {
    res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
});
const rateLimit = (req, res, next) => {
  const key = req.ip || 'global';
  const result = generalLimiter.hit(key, 120, 60_000);
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))));
    return res.status(429).json({ message: 'Too many requests. Please try again shortly.' });
  }
  next();
};
const loginRateLimit = (req, res, next) => {
  const key = `${req.ip || 'global'}:${String(req.body?.email || '').trim().toLowerCase()}`;
  const result = loginLimiter.hit(key, 5, 15 * 60_000);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))));
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }
  next();
};
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

app.get('/api/health', rateLimit, (_, res) => res.json({ ok: true, service: 'Election Monitoring Command API' }));
let oyoBoundaryCache = null;
app.get('/api/boundaries/oyo', rateLimit, asyncRoute(async (_req, res) => {
  if (oyoBoundaryCache?.expiresAt > Date.now()) return res.json(oyoBoundaryCache.data);
  const base = 'https://services3.arcgis.com/7J7WB6yJX0pYke9q/ArcGIS/rest/services/NCO_Security_Database_WFL1/FeatureServer';
  const queryLayer = async (layer, where) => {
    const params = new URLSearchParams({
      where,
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson'
    });
    const response = await fetch(`${base}/${layer}/query?${params}`, {
      headers: { 'User-Agent': 'Election-Monitor/1.0 boundary service' },
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) throw new Error(`Boundary provider returned ${response.status}`);
    const geojson = await response.json();
    if (!Array.isArray(geojson.features)) throw new Error('Boundary provider returned invalid GeoJSON');
    return geojson;
  };
  try {
    const [states, lgas] = await Promise.all([
      queryLayer('2', "ADM1_EN = 'Oyo'"),
      queryLayer('1', "ADM1_EN = 'Oyo'")
    ]);
    const data = {
      state: states,
      lgas,
      attribution: 'Administrative boundaries: ArcGIS feature service',
      fetchedAt: new Date().toISOString()
    };
    oyoBoundaryCache = { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.json(data);
  } catch (error) {
    console.error('[boundaries] Oyo boundary fetch failed:', error.message);
    return res.status(503).json({ message: 'Oyo boundary data is temporarily unavailable.' });
  }
}));
app.use(['/api/news/summary', '/api/analysis/ai'], (req, _res, next) => { console.log(`[ai] request=${req.path} geminiConfigured=${Boolean(process.env.GEMINI_API_KEY)} model=${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}`); next(); });
app.get('/api/ai/status', auth, adminOnly, rateLimit, (_, res) => {
  const provider = process.env.GROQ_API_KEY ? 'groq' : process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'none';
  const models = provider === 'groq'
    ? [groqPrimaryModel, groqFallbackModel]
    : provider === 'gemini'
      ? [process.env.GEMINI_MODEL || 'gemini-2.0-flash', process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash-lite']
      : [process.env.OPENAI_MODEL || null, process.env.OPENAI_FALLBACK_MODEL || null];
  res.json({ configured: provider !== 'none', provider, model: models[0], fallbackModel: models[1] });
});
app.get('/api/news', auth, rateLimit, asyncRoute(async (req, res) => {
  const q = String(req.query.q || 'Oyo State election').slice(0, 180);
  const providerArticles = [];
  if (process.env.GNEWS_API_KEY) {
    const gnewsQuery = /oyo|ibadan/i.test(q)
      ? '("Oyo State" OR Ibadan OR Ogbomoso OR Iseyin OR "Governor Makinde" OR "INEC Oyo" OR "Oyo APC" OR "Oyo PDP")'
      : q;
    const gnews = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(gnewsQuery)}&lang=en&max=50&sortby=publishedAt&apikey=${encodeURIComponent(process.env.GNEWS_API_KEY)}`, { headers: { 'User-Agent': 'Election-Monitor/1.0' } }).catch(() => null);
    if (gnews?.ok) {
      const payload = await gnews.json();
      const articles = (payload.articles || []).map(item => ({ title: normalizeNewsTitle(item.title, item.url), description: sanitizeString(item.description || ''), url: validateExternalUrl(item.url, ['https:']) ? item.url : '', source: sanitizeString(item.source?.name || ''), publishedAt: normalizeNewsDate(item.publishedAt), language: 'en' })).filter(item => item.title && item.url && isOyoStateNews(`${item.title} ${item.description}`)).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      console.log(`[news] provider=gnews query=${JSON.stringify(q)} total=${payload.totalArticles || 0} articles=${articles.length}`);
      providerArticles.push(...articles);
    }
  }
  // Keep the query broad: requiring every keyword at once produces empty
  // results because most articles mention only one location or party.
  const query = `("${q}" OR "Oyo State" OR Ibadan OR Ogbomoso OR Iseyin OR "Governor Makinde" OR "Oyo government" OR "INEC Oyo" OR "Oyo election" OR "Oyo APC" OR "Oyo PDP" OR "Oyo Labour Party")`;
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=50&sort=HybridRel`;
  let data;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Election-Monitor/1.0 news aggregation' } });
    if (response.ok) data = await response.json();
  } catch { /* fall through to RSS */ }
  const queries = [
    q,
    '"Oyo State"',
    '"Oyo State" news',
    '"Oyo State" government',
    '"Oyo State" security',
    'Ibadan news',
    'Ogbomoso news',
    'Iseyin Oyo news',
    '"Governor Makinde"',
    '"INEC Oyo"',
    '"Oyo State" election',
    '"Oyo State" political parties',
    '"Oyo APC"',
    '"Oyo PDP"',
    '"Oyo Labour Party"',
    '"Oyo NNPP"',
    '"Oyo SDP"',
    '"Oyo State House of Assembly"',
    '"Oyo State" local government',
    '"Oyo State" upcoming election'
  ];
  const feeds = queries.map(term => `https://news.google.com/rss/search?q=${encodeURIComponent(term)}&hl=en-NG&gl=NG&ceid=NG:en`).concat(['https://punchng.com/feed/', 'https://www.premiumtimesng.com/feed', 'https://guardian.ng/feed/']);
  const xmls = await Promise.all(feeds.map((feed, index) => fetch(feed, { headers: { 'User-Agent': 'Election-Monitor/1.0' } }).then(async r => ({ xml: r.ok ? await r.text() : '', searchContext: index < queries.length ? queries[index] : '' })).catch(() => ({ xml: '', searchContext: '' }))));
  const parseRss = ({ xml, searchContext }) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => { const block = m[1]; const read = tag => (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim(); return { title: read('title'), url: read('link') || read('guid'), domain: 'News feed', pubdate: read('pubDate'), searchContext }; });
  data = { articles: [...providerArticles, ...(Array.isArray(data?.articles) ? data.articles : []), ...xmls.flatMap(parseRss)] };
  const seen = new Set();
  const articles = (Array.isArray(data.articles) ? data.articles : [])
    .map(item => ({
      title: normalizeNewsTitle(item.title, item.url),
      description: sanitizeString(item.description || ''),
      url: validateExternalUrl(item.url, ['https:']) ? item.url : '',
      source: sanitizeString(item.source || item.domain || ''),
      publishedAt: normalizeNewsDate(item.publishedAt || item.seendate || item.pubdate),
      language: item.language || '',
      searchContext: item.searchContext || ''
    }))
    .filter(item => item.title && item.url && isOyoStateNews(`${item.title} ${item.description} ${item.searchContext}`) && !seen.has(item.url) && seen.add(item.url))
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .slice(0, 200)
    .map(({ searchContext: _searchContext, ...item }) => item);
  console.log(`[news] provider=${data === undefined ? 'none' : 'gdelt/rss'} query=${JSON.stringify(q)} articles=${articles.length}`);
  res.json({ articles, query: q, provider: 'gdelt/rss', fetchedAt: new Date().toISOString() });
}));
app.post('/api/news/summary', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
  const articles = Array.isArray(req.body?.articles) ? req.body.articles.slice(0, 30) : [];
  if (!articles.length) return res.status(400).json({ message: 'News articles are required.' });
  const newsPrompt = `Create a concise Oyo State news briefing using the supplied headlines and, when your model supports web search, current reputable web sources. Cover genuine Oyo State developments, prioritizing politics, INEC, elections, parties, governance, security, public services, and major local events. Return at most 160 words with exactly these plain-text sections: CURRENT PICTURE, TOP DEVELOPMENTS (maximum 4 bullets), WHAT TO MONITOR (maximum 3 bullets). Distinguish confirmed reporting from uncertainty. Do not include the OYO hotel company, use Markdown bold markers, persuade voters, or recommend partisan messaging.\n\nHEADLINES:\n${articles.map((item) => `${item.title} (${item.source})`).join('\n')}`;

  if (process.env.GROQ_API_KEY) {
    try {
      try {
        const text = await callGroq(newsPrompt, groqNewsModel);
        return res.json({ summary: text, model: groqNewsModel, provider: 'groq' });
      } catch (searchError) {
        console.error('[groq-news] search model failed:', searchError.status || '', searchError.message);
        const result = await callGroqWithFallback(newsPrompt);
        return res.json({ summary: result.text, model: result.model, provider: 'groq' });
      }
    } catch (error) {
      console.error('[groq-news] both models failed:', error.status || '', error.message);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const prompt = newsPrompt;
    const call = async (model) => {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('[gemini-news]', r.status, b?.error?.message || 'request failed');
        throw new Error(b?.error?.message || 'Gemini failed');
      }
      return b.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    };
    try {
      let model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
      let summary;
      try { summary = await call(model); } catch { model = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3-flash'; summary = await call(model); }
      return res.json({ summary, model, provider: 'gemini' });
    } catch (error) {
      console.error('[gemini-news] both models failed:', error.message);
      return res.json({ provider: 'local', model: 'statistical-fallback', summary: `AI provider unavailable. ${articles.length} Oyo-related headlines were retrieved. Review the linked sources, prioritize the newest reports, and verify claims against official Oyo State and INEC channels before acting.` });
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const prompt = `Summarize these election news headlines neutrally. Identify the hottest themes, confirmed facts versus uncertainty, and operational implications. Do not persuade voters or recommend partisan messaging.\n${articles.map((item) => `${item.title} (${item.source})`).join('\n')}`;
    const call = async (model) => {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: prompt, max_output_tokens: 600 }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(b?.error?.message || 'AI request failed'); e.status = r.status; throw e; }
      return b.output_text || '';
    };
    try {
      let model = openAiPrimaryModel;
      let summary;
      try { summary = await call(model); } catch (e) { if (![400, 404, 429].includes(e.status)) throw e; model = openAiFallbackModel; summary = await call(model); }
      return res.json({ summary, model, provider: 'openai' });
    } catch {
      return res.status(503).json({ message: 'AI news summary unavailable.' });
    }
  }

  return res.json({ summary: summarizeNewsLocally(articles), provider: 'local', model: 'local-fallback' });
}));
app.post('/api/analysis/ai', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
  const context = req.body?.context || {};
  const operationalPrompt = `Produce a concise, neutral Oyo election-operations briefing from this structured data. Return no more than 180 words with exactly these plain-text sections: STATUS, URGENT RISKS (maximum 4 bullets), NEXT ACTIONS (maximum 4 bullets), CONFIDENCE. Prioritize verified SOS and critical incidents, missing evidence, reporting coverage, and vote-data uncertainty. Avoid repeating the raw counts more than once. Do not use Markdown bold markers, target voters, or recommend partisan persuasion.\n\nDATA:\n${JSON.stringify(context)}`;

  if (process.env.GROQ_API_KEY) {
    try {
      const result = await callGroqWithFallback(operationalPrompt);
      return res.json({ analysis: result.text, model: result.model, provider: 'groq' });
    } catch (error) {
      console.error('[groq-analysis] both models failed:', error.status || '', error.message);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const prompt = operationalPrompt;
    const call = async (model) => {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('[gemini-analysis]', r.status, b?.error?.message || 'request failed');
        throw new Error(b?.error?.message || 'Gemini failed');
      }
      return b.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    };
    try {
      let model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
      let analysis;
      try { analysis = await call(model); } catch { model = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3-flash'; analysis = await call(model); }
      return res.json({ analysis, model, provider: 'gemini' });
    } catch (error) {
      console.error('[gemini-analysis] both models failed:', error.message);
      return res.json({ analysis: analyzeContextLocally(context), provider: 'local', model: 'local-fallback' });
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const sanitizedContext = sanitizeString(JSON.stringify(context), '').slice(0, 12000);
    if (!sanitizedContext) return res.status(400).json({ message: 'Analysis context is required.' });
    const prompt = `Provide a neutral operational election-monitoring analysis from this structured data. Do not persuade voters, target demographic groups, or recommend partisan messaging. Summarize uncertainty, data quality, incident/SOS priorities, and verification actions.\n\nDATA:\n${sanitizedContext}`;
    const callModel = async (model) => {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: prompt, max_output_tokens: 700 }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(body?.error?.message || 'OpenAI request failed'); error.status = response.status; throw error; }
      return body.output_text || body.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('') || '';
    };
    try {
      let usedModel = openAiPrimaryModel;
      let analysis;
      try { analysis = await callModel(usedModel); } catch (error) {
        if (usedModel === openAiFallbackModel || ![400, 404, 429].includes(error.status)) throw error;
        usedModel = openAiFallbackModel;
        analysis = await callModel(usedModel);
      }
      return res.json({ analysis, model: usedModel, fallbackUsed: usedModel !== openAiPrimaryModel, provider: 'openai' });
    } catch (error) {
      console.error('AI analysis unavailable:', error.message);
      return res.status(503).json({ message: 'AI analysis is temporarily unavailable; statistical analysis remains available.' });
    }
  }

  return res.json({ analysis: analyzeContextLocally(context), provider: 'local', model: 'local-fallback' });
}));
app.get('/api/admin/ip-log', auth, adminOnly, rateLimit, (req, res) => {
  const { userId, type, limit = 200 } = req.query;
  let results = ipLog;
  if (userId) results = results.filter(entry => entry.userId === userId);
  if (type) results = results.filter(entry => entry.type === type);
  res.json(results.slice(0, Number(limit)));
});
app.post('/api/auth/login', loginRateLimit, asyncRoute(async (req, res) => {
  const email = sanitizeString(req.body.email || '').toLowerCase();
  const password = String(req.body.password || '');
  if (!validateEmail(email) || !password || password.length > 1024) return res.status(400).json({ message: 'A valid email and password are required.' });
  const user = await store.userByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid email or password' });
  if (!user.active) return res.status(403).json({ message: 'This account is disabled.' });
  const safe = publicUser(user);
  const token = issueToken(user);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ token, user: safe });
}));
app.post('/api/auth/logout', (req, res) => { res.setHeader('Set-Cookie', clearSessionCookie); res.status(204).end(); });
app.put('/api/profile', auth, rateLimit, asyncRoute(async (req, res) => {
  const current = await store.userByEmail(req.user.email);
  if (!current) return res.status(404).json({ message: 'Account not found' });
  const password = String(req.body.password || '');
  const nextName = sanitizeString(req.body.name || current.name).trim();
  const nextEmail = sanitizeString(req.body.email || current.email).trim().toLowerCase();
  const nextStation = sanitizeString(req.body.station || current.station || '').trim();
  if (!validateEmail(nextEmail)) return res.status(400).json({ message: 'A valid email is required.' });
  if (password && !validatePassword(password)) return res.status(400).json({ message: 'Password must be at least 12 characters and include upper, lower, number, and special characters.' });
  if (password && !(await bcrypt.compare(String(req.body.currentPassword || ''), current.password))) return res.status(403).json({ message: 'Current password is incorrect.' });
  const existing = (await store.users()).find(user => user.id !== current.id && user.email.toLowerCase() === nextEmail);
  if (existing) return res.status(409).json({ message: 'Email is already in use' });
  const updated = await store.updateUserProfile(current.id, { name: nextName, email: nextEmail, station: nextStation, password: password ? await bcrypt.hash(password, 10) : null });
  const safe = publicUser(updated); const token = issueToken(updated);
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ user: safe, token });
}));
app.get('/api/users', auth, rateLimit, asyncRoute(async (req, res) => res.json(visibleUsersFor(req.user, await store.users()).map(publicUser))));
app.get('/api/report-viewers', auth, rateLimit, asyncRoute(async (req, res) => res.json(visibleUsersFor(req.user, await store.users()).map(publicUser))));
app.post('/api/users', auth, rateLimit, asyncRoute(async (req, res) => {
  if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = req.body.role || 'Agent';
  const rank = String(req.body.rank || '').trim();
  if (!req.body.name || !validateEmail(email) || !req.body.password) return res.status(400).json({ message: 'Name, a valid email and password are required' });
  if (!rank) return res.status(400).json({ message: 'Rank is required' });
  if (!canCreateUser(req.user, rank, role)) return res.status(403).json({ message: 'You can only create accounts below your rank' });
  if (!validatePassword(String(req.body.password || ''))) return res.status(400).json({ message: 'Password must be at least 12 characters and include upper, lower, number, and special characters.' });
  if ((await store.users()).some(user => user.email.toLowerCase() === email)) return res.status(409).json({ message: 'An account with that email already exists' });
  const user = {
    id: createId('u'),
    name: sanitizeString(req.body.name).trim(), email,
    password: await bcrypt.hash(String(req.body.password), 10),
    role, rank: role,
    active: true,
    unit: req.body.unit || 'Field Unit',
    unitType: String(req.body.unitType || 'Division').trim(),
    command: String(req.body.command || '').trim(),
    division: String(req.body.division || '').trim(),
    station: String(req.body.station || '').trim(),
    state: String(req.body.state || '').trim(),
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
app.delete('/api/users/:id', auth, rateLimit, asyncRoute(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account' });
  const target = (await store.users()).find(user => user.id === req.params.id);
  if (!canDeleteUser(req.user, target)) return res.status(403).json({ message: 'You are not allowed to delete this account' });
  const deleted = await store.deleteUser(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Personnel account not found' });
  io.emit('user:deleted', req.params.id);
  res.status(204).end();
}));
app.put('/api/users/:id', auth, rateLimit, asyncRoute(async (req, res) => {
  const target = (await store.users()).find(user => user.id === req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (req.user.id === target.id) return res.status(400).json({ message: 'Use the profile endpoint to update your own account' });
  if (req.user.id !== target.id && req.user.role !== 'Super Admin' && !canManageRank(req.user.rank, target.rank)) return res.status(403).json({ message: 'You can only update accounts below your rank' });
  const changes = {
    name: String(req.body.name || target.name).trim(),
    email: String(req.body.email || target.email).trim().toLowerCase(),
    role: target.role,
    rank: target.rank,
    active: target.active,
    unit: String(req.body.unit || target.unit).trim(),
    unitType: String(req.body.unitType || target.unitType).trim(),
    command: String(req.body.command || target.command).trim(),
    division: String(req.body.division || target.division).trim(),
    station: String(req.body.station || target.station).trim(),
    state: String(req.body.state || target.state).trim(),
    lga: String(req.body.lga || target.lga).trim(),
    ward: String(req.body.ward || target.ward).trim(),
    pollingUnit: String(req.body.pollingUnit || target.pollingUnit).trim(),
    lat: Number(req.body.lat ?? target.lat) || 7.3775,
    lng: Number(req.body.lng ?? target.lng) || 3.9470,
  };
  const existing = (await store.users()).find(user => user.id !== target.id && user.email.toLowerCase() === changes.email.toLowerCase());
  if (existing) return res.status(409).json({ message: 'Email is already in use' });
  const updated = await store.updateUser(req.params.id, changes);
  io.emit('user:updated', publicUser(updated));
  res.json(publicUser(updated));
}));
app.put('/api/users/:id/role', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
  const target = (await store.users()).find(user => user.id === req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (!canManageRank(req.user.rank, target.rank)) return res.status(403).json({ message: 'You can only change roles for accounts below your rank' });
  const allowedRoles = ['Supervisor', 'Agent'];
  const newRole = String(req.body.role || '').trim();
  if (!allowedRoles.includes(newRole)) return res.status(400).json({ message: 'Role must be Supervisor or Agent' });
  if (newRole === target.role && !req.body.ward) return res.status(400).json({ message: 'No changes to apply' });
  const changes = {
    name: target.name, email: target.email, role: newRole, rank: newRole, active: target.active,
    unit: target.unit, unitType: target.unitType, command: target.command, division: target.division,
    station: target.station, state: target.state, lga: target.lga,
    ward: req.body.ward ? String(req.body.ward).trim() : target.ward,
    pollingUnit: newRole === 'Supervisor' ? (target.pollingUnit || '') : (req.body.pollingUnit ? String(req.body.pollingUnit).trim() : target.pollingUnit),
    lat: target.lat, lng: target.lng,
  };
  const updated = await store.updateUser(req.params.id, changes);
  io.emit('user:updated', publicUser(updated));
  res.json(publicUser(updated));
}));
app.put('/api/users/:id/password', auth, rateLimit, asyncRoute(async (req, res) => {
  const users = await store.users();
  const target = users.find(user => user.id === req.params.id);
  if (!target) return res.status(404).json({ message: 'Account not found' });
  if (target.id === req.user.id) return res.status(400).json({ message: 'Use the profile endpoint to change your own password' });
  if (!canDeleteUser(req.user, target)) return res.status(403).json({ message: 'You cannot reset this account password' });
  const password = String(req.body.password || '');
  if (!validatePassword(password)) return res.status(400).json({ message: 'Password must be at least 12 characters and include upper, lower, number, and special characters.' });
  await store.updateUserPassword(target.id, await bcrypt.hash(password, 12));
  res.status(204).end();
}));
app.get('/api/parties', auth, rateLimit, asyncRoute(async (_, res) => res.json(await store.parties())));
app.put('/api/parties', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
  const parties = [...new Set((Array.isArray(req.body.parties) ? req.body.parties : []).map(value => String(value).trim()).filter(Boolean))].slice(0, 100);
  const saved = await store.setParties(parties);
  io.emit('parties:updated', saved);
  res.json(saved);
}));
app.post('/api/results', auth, rateLimit, asyncRoute(async (req, res) => {
  const parties = await store.parties();
  const rawEntries = (Array.isArray(req.body.results) ? req.body.results : []).map(item => ({ party: String(item.party || '').trim(), votes: Number(item.votes) })).filter(item => parties.includes(item.party) && Number.isInteger(item.votes) && item.votes >= 0);
  const entries = [...rawEntries.reduce((map, item) => map.set(item.party, { party: item.party, votes: (map.get(item.party)?.votes || 0) + item.votes }), new Map()).values()];
  if (!entries.length) return res.status(400).json({ message: 'Select at least one uploaded party and enter its vote count' });
  const media = Array.isArray(req.body.media) ? req.body.media.slice(0, 3) : [];
  const mediaValidation = validateMediaPayload(media);
  if (!mediaValidation.valid) return res.status(400).json({ message: mediaValidation.errors[0] || 'Invalid media payload' });
  if (!media.some(item => item?.type === 'image')) return res.status(400).json({ message: 'A photograph of the signed result is required' });
  const lat = Number(req.body.lat); const lng = Number(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ message: 'Current location is required' });
  const pollingUnit = String(req.user.pollingUnit || req.body.pollingUnit || '').trim();
  if (!pollingUnit) return res.status(400).json({ message: 'The reporting account must have a polling unit' });
  const createdAt = new Date().toISOString();
  const result = { id: createId('r'), title: `Polling Unit Result - ${sanitizeString(pollingUnit)}`, description: `Submitted by ${sanitizeString(req.user.name)} at ${createdAt}`, reportType: 'Polling Unit Result', severity: 'Low', status: 'Submitted', lat, lng, assignedTo: '', visibleTo: [], media, geometry: null, style: { source: 'result', icon: 'POI', color: '#d9aa4b', fillColor: '#d9aa4b' }, lga: req.user.lga || req.body.lga || '', ward: req.user.ward || req.body.ward || '', pollingUnit, resultCount: JSON.stringify(entries), createdAt, createdBy: req.user.id };
  const created = await store.createIncident(result);
  logIp('result', req.user, created.id, getClientIp(req));
  io.emit('incident:created', created);
  res.status(201).json(created);
}));
app.get('/api/incidents', auth, rateLimit, asyncRoute(async (req, res) => res.json((await store.incidents()).filter(incident => canAccessIncident(req.user, incident)))));
app.post('/api/incidents', auth, rateLimit, asyncRoute(async (req, res) => {
  const media = Array.isArray(req.body.media) ? req.body.media.slice(0, 6) : [];
  const mediaValidation = validateMediaPayload(media);
  if (!mediaValidation.valid) return res.status(400).json({ message: mediaValidation.errors[0] || 'Invalid media payload' });
  const mediaBytes = media.reduce((total, item) => total + Buffer.byteLength(String(item?.data || ''), 'utf8'), 0);
  if (mediaBytes > 10 * 1024 * 1024) return res.status(413).json({ message: 'Incident attachments are too large. Keep the total under 10MB.' });
  const allowedTypes = new Set(['SOS-Emergency', 'Vote Buying', 'Thuggery and Violence', 'Voter Intimidation', 'Collusion', 'Compromised Privacy', 'Over-voting', 'Late Opening', 'Material Shortages', 'Missing Registers', 'Lack of Crowd Control', 'BVAS Failure', 'Network Connectivity', 'Battery Depletion']);
  if (['Agent', 'Supervisor'].includes(req.user.role) && !allowedTypes.has(req.body.reportType)) return res.status(403).json({ message: 'This role cannot create that report type' });
  const lga = String(req.user.lga || req.body.lga || '').trim();
  const ward = String(req.user.ward || req.body.ward || '').trim();
  const pollingUnit = String((req.user.role === 'Agent' ? req.user.pollingUnit : req.body.pollingUnit) || '').trim();
  const visibleTo = [...new Set([
    ...(Array.isArray(req.body.visibleTo) ? req.body.visibleTo : []),
    ...(isSosIncident(req.body) ? sosVisibleTo({ ...req.user, userId: req.user.id, ...req.body }) : []),
    req.body.assignedTo
  ].filter(Boolean))];
  const incident = {
    title: normalizeText(req.body.title || 'Incident'),
    description: normalizeText(req.body.description || ''),
    reportType: normalizeText(req.body.reportType || 'IP'),
    severity: ['Low', 'Medium', 'High', 'Critical'].includes(req.body.severity) ? req.body.severity : 'High',
    status: ['Open', 'In Progress', 'Resolved', 'Submitted'].includes(req.body.status) ? req.body.status : 'Open',
    lat: Number(req.body.lat), lng: Number(req.body.lng), assignedTo: visibleTo.includes(req.body.assignedTo) ? req.body.assignedTo : '',
    lga, ward, pollingUnit, visibleTo, media,
    id: createId('i'), createdAt: new Date().toISOString(), createdBy: req.user.id,
  };
  if (!validateCoordinates(incident.lat, incident.lng)) return res.status(400).json({ message: 'Valid incident coordinates are required' });
  const created = await store.createIncident(incident);
  logIp('incident', req.user, created.id, getClientIp(req));
  io.emit('incident:created', created);
  res.status(201).json(created);
}));
app.put('/api/incidents/:id', auth, rateLimit, asyncRoute(async (req, res) => {
  const current = (await store.incidents()).find(item => item.id === req.params.id);
  if (!current || !canAccessIncident(req.user, current)) return res.status(404).json({ message: 'Incident not found' });
  const mayManage = isAdminRole(req.user) || current.createdBy === req.user.id || current.assignedTo === req.user.id;
  if (!mayManage) return res.status(403).json({ message: 'You may view this incident but cannot modify it' });
  const allowedKeys = isAdminRole(req.user)
    ? ['title', 'description', 'severity', 'status', 'assignedTo', 'visibleTo', 'geometry', 'style']
    : ['description', 'status'];
  const patch = {};
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  if (patch.title !== undefined) patch.title = normalizeText(patch.title);
  if (patch.description !== undefined) patch.description = normalizeText(patch.description);
  if (patch.status !== undefined && !['Open', 'In Progress', 'Resolved', 'Submitted'].includes(patch.status)) return res.status(400).json({ message: 'Invalid incident status' });
  if (patch.severity !== undefined && !['Low', 'Medium', 'High', 'Critical'].includes(patch.severity)) return res.status(400).json({ message: 'Invalid incident severity' });
  if (patch.visibleTo !== undefined) {
    const knownUserIds = new Set((await store.users()).map(user => user.id));
    patch.visibleTo = [...new Set((Array.isArray(patch.visibleTo) ? patch.visibleTo : []).filter(id => knownUserIds.has(id)))];
  }
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'No permitted incident changes supplied' });
  const incident = await store.updateIncident(req.params.id, patch);
  if (!incident) return res.status(404).json({ message: 'Incident not found' });
  io.emit('incident:updated', incident);
  res.json(incident);
}));
app.delete('/api/incidents/:id', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => { await store.deleteIncident(req.params.id); io.emit('incident:deleted', req.params.id); res.status(204).end(); }));
app.post('/api/incidents/:id/chat', auth, rateLimit, asyncRoute(async (req, res) => {
  const incident = (await store.incidents()).find(item => item.id === req.params.id);
  if (!incident) return res.status(404).json({ message: 'Incident not found' });
  if (!canAccessIncident(req.user, incident)) return res.status(403).json({ message: 'Only assigned viewers and command can open this incident chat' });
  const room = await store.incidentChatRoom(incident, req.user);
  io.emit('chat:room', room);
  res.json(room);
}));
app.get('/api/cameras', auth, rateLimit, asyncRoute(async (_, res) => res.json(await store.cameras())));
app.post('/api/cameras', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
  if (!req.body.name || !req.body.url) return res.status(400).json({ message: 'Camera name and stream URL are required' });
  if (!validateExternalUrl(req.body.url, ['https:'])) return res.status(400).json({ message: 'Camera URL must be an HTTPS URL without embedded credentials' });
  const lat = Number(req.body.lat ?? 7.3775); const lng = Number(req.body.lng ?? 3.9470);
  if (!validateCoordinates(lat, lng)) return res.status(400).json({ message: 'Invalid camera coordinates' });
  const camera = { id: createId('cam'), name: normalizeText(req.body.name), type: normalizeText(req.body.type || 'CCTV'), url: String(req.body.url), lat, lng, status: 'Online', createdAt: new Date().toISOString() };
  const created = await store.createCamera(camera);
  io.emit('camera:created', created);
  res.status(201).json(created);
}));
app.delete('/api/cameras/:id', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => { await store.deleteCamera(req.params.id); io.emit('camera:deleted', req.params.id); res.status(204).end(); }));
app.get('/api/map-layers', auth, rateLimit, asyncRoute(async (_, res) => res.json(await store.mapLayers())));
app.post('/api/map-layers', auth, superAdminOnly, rateLimit, asyncRoute(async (req, res) => {
  if (!req.body.name || !req.body.type) return res.status(400).json({ message: 'Layer name and type are required' });
  const layer = { id: createId('layer'), name: sanitizeString(req.body.name).trim(), type: req.body.type, data: req.body.data || null, url: sanitizeString(req.body.url || ''), bounds: req.body.bounds || null, opacity: Number(req.body.opacity) || 0.65, fillOpacity: Number(req.body.fillOpacity ?? 0.18), category: sanitizeString(req.body.category || (req.body.type === 'raster' ? 'Raster' : 'Point')).trim() || 'Point', operationalUse: sanitizeString(req.body.operationalUse || 'Reference').trim() || 'Reference', color: sanitizeString(req.body.color || '#facc15'), fillColor: sanitizeString(req.body.fillColor || req.body.color || '#f59e0b'), lineWeight: Number(req.body.lineWeight) || 2, lineStyle: sanitizeString(req.body.lineStyle || 'solid'), pointIcon: sanitizeString(req.body.pointIcon || 'pin'), pointIconColor: sanitizeString(req.body.pointIconColor || '#ffffff'), pointSize: Number(req.body.pointSize) || 24, showLabels: req.body.showLabels ?? true, labelField: sanitizeString(req.body.labelField || 'name'), popupFields: sanitizeString(req.body.popupFields || ''), visible: req.body.visible ?? true, zIndex: Number(req.body.zIndex) || 0, createdAt: new Date().toISOString() };
  const created = await store.createMapLayer(layer);
  io.emit('map-layer:created', created);
  res.status(201).json(created);
}));
app.put('/api/map-layers/:id', auth, rateLimit, asyncRoute(async (req, res) => {
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
app.delete('/api/map-layers/:id', auth, superAdminOnly, rateLimit, asyncRoute(async (req, res) => { await store.deleteMapLayer(req.params.id); io.emit('map-layer:deleted', req.params.id); res.status(204).end(); }));
app.get('/api/chat/rooms', auth, rateLimit, asyncRoute(async (req, res) => res.json(await store.chatRooms(req.user))));
app.post('/api/chat/rooms', auth, rateLimit, asyncRoute(async (req, res) => {
  if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
  const name = sanitizeString(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Room name is required' });
  const allowedUsers = visibleUsersFor(req.user, await store.users());
  const allowedIds = new Set(allowedUsers.map(user => user.id));
  const memberIds = (Array.isArray(req.body.memberIds) ? req.body.memberIds : [req.body.userId]).filter(id => id && allowedIds.has(id));
  const room = await store.createChatRoom({ id: `room-${Date.now()}`, name, type: 'room', incidentId: '', createdBy: req.user.id, createdAt: new Date().toISOString() }, memberIds);
  io.emit('chat:room', room);
  res.status(201).json(room);
}));
app.post('/api/chat/rooms/:id/members', auth, rateLimit, asyncRoute(async (req, res) => {
  if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
  const room = await store.chatRoom(req.params.id);
  if (!room) return res.status(404).json({ message: 'Chat room not found' });
  const target = (await store.users()).find(user => user.id === req.body.userId);
  if (!target || !visibleUsersFor(req.user, [target]).length) return res.status(403).json({ message: 'You cannot add this user to the chat' });
  const updated = await store.addChatMember(req.params.id, target.id);
  io.emit('chat:room', updated);
  res.json(updated);
}));
app.delete('/api/chat/rooms/:id', auth, rateLimit, asyncRoute(async (req, res) => {
  if (!canManageUsers(req.user)) return res.status(403).json({ message: 'You do not have lower ranks to manage' });
  const room = await store.chatRoom(req.params.id);
  if (!room) return res.status(404).json({ message: 'Chat room not found' });
  const deleted = await store.deleteChatRoom(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Chat room not found' });
  io.emit('chat:deleted', req.params.id);
  res.status(204).end();
}));
app.get('/api/chat/rooms/:id/messages', auth, rateLimit, asyncRoute(async (req, res) => {
  const room = await store.chatRoom(req.params.id);
  if (!canAccessRoom(req.user, room)) return res.status(403).json({ message: 'You cannot view this chat' });
  res.json(await store.chatMessages(req.params.id));
}));
app.post('/api/chat/rooms/:id/messages', auth, rateLimit, asyncRoute(async (req, res) => {
  const room = await store.chatRoom(req.params.id);
  if (!canAccessRoom(req.user, room)) return res.status(403).json({ message: 'You cannot send to this chat' });
  const body = normalizeText(req.body.body || '').trim();
  if (!body) return res.status(400).json({ message: 'Message cannot be empty' });
  const message = await store.createChatMessage({ id: createId('msg'), roomId: req.params.id, senderId: req.user.id, body, createdAt: new Date().toISOString() });
  io.emit('chat:message', { roomId: req.params.id, message });
  res.status(201).json(message);
}));
app.post('/api/gps/ping', auth, rateLimit, (req, res) => {
  const lat = Number(req.body.lat); const lng = Number(req.body.lng);
  if (!validateCoordinates(lat, lng)) return res.status(400).json({ message: 'Invalid GPS coordinates' });
  const point = { lat, lng, accuracy: Math.max(0, Math.min(Number(req.body.accuracy) || 0, 100_000)), userId: req.user.id, timestamp: new Date().toISOString() };
  io.emit('gps:broadcast', point);
  res.json({ received: true });
});
io.use((socket, next) => {
  authenticateToken(socket.handshake.auth?.token || '')
    .then(user => { socket.data.authUser = user; next(); })
    .catch(() => next(new Error('Unauthorized realtime connection')));
});
io.on('connection', socket => {
  socket.data.user = { ...socket.data.authUser, userId: socket.data.authUser.id };
  socket.on('gps:update', point => {
    if (!socketLimiter.hit(`gps:${socket.data.authUser.id}`, 30, 60_000).allowed) return;
    const lat = Number(point?.lat); const lng = Number(point?.lng);
    if (!validateCoordinates(lat, lng)) return;
    const safePoint = { userId: socket.data.authUser.id, lat, lng, accuracy: Math.max(0, Math.min(Number(point?.accuracy) || 0, 100_000)), timestamp: new Date().toISOString() };
    socket.data.user = { ...(socket.data.user || {}), userId: safePoint.userId, lat: safePoint.lat, lng: safePoint.lng };
    io.emit('gps:broadcast', safePoint);
  });
  socket.on('gps:stop', () => io.emit('gps:offline', { userId: socket.data.authUser.id, timestamp: new Date().toISOString() }));
  socket.on('emergency:send', alert => {
    if (!socketLimiter.hit(`emergency:${socket.data.authUser.id}`, 5, 60_000).allowed) return socket.emit('operation:error', { message: 'Too many emergency alerts. Please try again shortly.' });
    const ip = socket.handshake.address || 'unknown';
    const user = socket.data.authUser;
    const lat = Number(alert?.lat); const lng = Number(alert?.lng);
    if (!validateCoordinates(lat, lng)) return socket.emit('operation:error', { message: 'Invalid emergency location' });
    const alertId = createId('em');
    logIp('SOS', { id: user.id, name: user.name, role: user.role }, alertId, ip);
    emitEmergencyAlert(socket, { ...(socket.data.user || {}), id: alertId, type: normalizeText(alert?.type || 'Emergency'), text: normalizeText(alert?.text || ''), lat, lng, userId: user.id, name: user.name, role: user.role });
  });
  socket.on('camera:register', user => {
    const lat = Number(user?.lat); const lng = Number(user?.lng);
    const safeUser = { ...socket.data.authUser, userId: socket.data.authUser.id };
    if (validateCoordinates(lat, lng)) Object.assign(safeUser, { lat, lng });
    socket.data.cameraUser = { userId: safeUser.userId, name: safeUser.name, role: safeUser.role };
    socket.data.user = { ...(socket.data.user || {}), ...safeUser };
    socket.join(`camera:user:${safeUser.userId}`);
    if (isAdminRole(safeUser)) socket.emit('camera:shares:list', [...activeCameraShares.values()]);
  });
  socket.on('camera:share:start', payload => {
    if (!['Agent', 'Supervisor', 'Response Team'].includes(socket.data.authUser.role)) return;
    const safePayload = { userId: socket.data.authUser.id, name: socket.data.authUser.name, role: socket.data.authUser.role, mode: normalizeText(payload?.mode || '') };
    activeCameraShares.set(safePayload.userId, safePayload);
    for (const client of io.sockets.sockets.values()) if (isAdminRole(client.data.authUser)) client.emit('camera:share:start', safePayload);
  });
  socket.on('camera:share:stop', () => { const userId = socket.data.authUser.id; activeCameraShares.delete(userId); socket.broadcast.emit('camera:share:stop', { userId }); });
  socket.on('camera:view:request', ({ officerId } = {}) => {
    if (!isAdminRole(socket.data.authUser) || !activeCameraShares.has(officerId)) return;
    io.to(`camera:user:${officerId}`).emit('camera:viewer:request', { viewerSocketId: socket.id });
  });
  socket.on('camera:signal', ({ target, data } = {}) => {
    if (!socketLimiter.hit(`signal:${socket.data.authUser.id}`, 120, 60_000).allowed) return;
    const peer = io.sockets.sockets.get(target);
    if (!peer || JSON.stringify(data || {}).length > 100_000) return;
    const senderIsAdmin = isAdminRole(socket.data.authUser);
    const peerIsAdmin = isAdminRole(peer.data.authUser);
    if (senderIsAdmin === peerIsAdmin) return;
    io.to(target).emit('camera:signal', { from: socket.id, fromUserId: socket.data.authUser.id, fromName: socket.data.authUser.name, data });
  });
  socket.on('disconnect', () => { const user = socket.data.cameraUser; if (['Agent', 'Supervisor', 'Response Team'].includes(user?.role) && activeCameraShares.has(user.userId)) { activeCameraShares.delete(user.userId); socket.broadcast.emit('camera:share:stop', { userId: user.userId }); } });
});

app.use((err, _, res, __) => {
  console.error(process.env.NODE_ENV === 'production' ? (err?.message || 'Unhandled request error') : err);
  res.status(500).json({ message: 'Server error. Please check logs.' });
});

if (process.env.NODE_ENV === 'production') { app.use(express.static(join(__dirname, '..', 'dist'))); app.get(/.*/, (_, res) => res.sendFile(join(__dirname, '..', 'dist', 'index.html'))); }
server.listen(process.env.PORT || 5000, '0.0.0.0', () => console.log(`Election Monitoring Command API listening on port ${process.env.PORT || 5000}`));
