import http from 'node:http';
import { readFile, writeFile, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { createHmac, randomUUID } from 'node:crypto';

const port = Number(process.env.MEDIA_PORT || 8787);
const sharedSecret = String(process.env.MEDIA_SERVICE_SHARED_SECRET || '').trim();
const callbackUrl = String(process.env.MEDIA_API_CALLBACK_URL || '').trim();
const stateFile = process.env.MEDIA_STATE_FILE || join(process.cwd(), 'media-state.json');
const uploadRoot = process.env.MEDIA_UPLOAD_DIR || join(process.cwd(), 'media-uploads');
if (!sharedSecret) throw new Error('MEDIA_SERVICE_SHARED_SECRET is required.');
const revoked = new Map();
const sessions = new Map();
const recordings = new Map();

const persist = async () => {
  await mkdir(join(stateFile, '..'), { recursive: true }).catch(() => {});
  await writeFile(stateFile, JSON.stringify({ sessions: [...sessions.values()], recordings: [...recordings.values()] }));
};
const load = async () => {
  try {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    for (const session of state.sessions || []) sessions.set(session.id, session);
    for (const recording of state.recordings || []) recordings.set(recording.id, recording);
  } catch {}
};
const authenticate = (token) => {
  const claims = jwt.verify(token, sharedSecret, { algorithms: ['HS256'], issuer: 'sigar-election-api', audience: 'sigar-media-service' });
  if (claims.jti && revoked.has(claims.jti)) throw new Error('Media token revoked.');
  if (!claims.scope?.some((scope) => scope === `camera:${claims.cameraId}:${claims.mode}`)) throw new Error('Media token scope is invalid.');
  return claims;
};
const callback = async (event, data) => {
  if (!callbackUrl) return;
  const body = JSON.stringify({ event, ...data, emittedAt: new Date().toISOString() });
  const signature = createHmac('sha256', sharedSecret).update(body).digest('hex');
  await fetch(callbackUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-media-signature': signature }, body }).catch(() => {});
};
const writeChunk = async (recording, offset, chunk) => {
  await mkdir(uploadRoot, { recursive: true });
  const path = join(uploadRoot, `${recording.id}.upload`);
  let file;
  try { file = await open(path, 'r+'); }
  catch { file = await open(path, 'w+'); }
  try { await file.write(chunk, 0, chunk.length, offset); }
  finally { await file.close(); }
  recording.uploadedBytes = Math.max(Number(recording.uploadedBytes || 0), offset + chunk.length);
};
const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, service: 'media-server' });
  const body = await new Promise((resolve) => { let value = ''; req.on('data', (chunk) => { value += chunk; }); req.on('end', () => { try { resolve(JSON.parse(value || '{}')); } catch { resolve({}); } }); });
  try {
    if (req.method === 'POST' && req.url === '/v1/sessions/revoke') {
      const claims = authenticate(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
      if (body.jti) revoked.set(body.jti, claims.exp * 1000);
      return json(res, 204, {});
    }
    const claims = authenticate(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (req.method === 'POST' && req.url === '/v1/recordings') {
      if (claims.mode !== 'publish') return json(res, 403, { message: 'A publish token is required.' });
      const recording = { id: randomUUID(), cameraId: claims.cameraId, ownerId: claims.sub, status: 'recording', startedAt: new Date().toISOString(), storage: 'media-object-store', source: body.source || 'webrtc-session' };
      recordings.set(recording.id, recording); await persist(); await callback('recording.started', recording); return json(res, 201, recording);
    }
    if (req.method === 'POST' && req.url?.startsWith('/v1/recordings/') && req.url.endsWith('/stop')) {
      const id = req.url.split('/')[3]; const recording = recordings.get(id);
      if (!recording || recording.ownerId !== claims.sub) return json(res, 404, { message: 'Recording not found.' });
      recording.status = 'processing'; recording.stoppedAt = new Date().toISOString(); recordings.set(id, recording); await persist(); await callback('recording.processing', recording); return json(res, 202, recording);
    }
    if (req.method === 'POST' && req.url?.startsWith('/v1/recordings/') && req.url.endsWith('/chunks')) {
      const id = req.url.split('/')[3]; const recording = recordings.get(id);
      if (!recording || recording.ownerId !== claims.sub) return json(res, 404, { message: 'Recording not found.' });
      if (!['recording', 'uploading'].includes(recording.status)) return json(res, 409, { message: 'Recording is no longer uploadable.' });
      const offset = Number(body.offset);
      const chunk = Buffer.from(String(body.chunkBase64 || ''), 'base64');
      if (!Number.isInteger(offset) || offset < 0 || !chunk.length || chunk.length > 10 * 1024 * 1024) return json(res, 400, { message: 'A valid upload offset and chunk are required.' });
      if (offset !== Number(recording.uploadedBytes || 0)) return json(res, 409, { code: 'UPLOAD_OFFSET_CONFLICT', expectedOffset: Number(recording.uploadedBytes || 0) });
      await writeChunk(recording, offset, chunk); recording.status = 'uploading'; recording.updatedAt = new Date().toISOString(); recordings.set(id, recording); await persist();
      return json(res, 200, { recordingId: id, nextOffset: recording.uploadedBytes, status: recording.status });
    }
    if (req.method === 'POST' && req.url?.startsWith('/v1/recordings/') && req.url.endsWith('/finalize')) {
      const id = req.url.split('/')[3]; const recording = recordings.get(id);
      if (!recording || recording.ownerId !== claims.sub) return json(res, 404, { message: 'Recording not found.' });
      if (!Number(recording.uploadedBytes || 0)) return json(res, 409, { message: 'Recording has no uploaded content.' });
      recording.status = 'finalized'; recording.finalizedAt = new Date().toISOString(); recording.sha256 = String(body.sha256 || ''); recordings.set(id, recording); await persist(); await callback('recording.finalized', recording); return json(res, 200, recording);
    }
    return json(res, 404, { message: 'Media endpoint not found.' });
  } catch (error) { return json(res, 401, { message: error.message }); }
});

const io = new Server(server, { cors: { origin: true, credentials: true }, maxHttpBufferSize: 100_000, perMessageDeflate: false });
io.use((socket, next) => { try { socket.data.claims = authenticate(socket.handshake.auth?.token || ''); next(); } catch (error) { next(new Error(error.message)); } });
io.on('connection', (socket) => {
  const claims = socket.data.claims;
  const session = { id: socket.id, cameraId: claims.cameraId, userId: claims.sub, mode: claims.mode, connectedAt: new Date().toISOString() };
  sessions.set(socket.id, session); persist();
  socket.on('media:signal', ({ target, data } = {}) => {
    if (!target || JSON.stringify(data || {}).length > 100_000) return;
    const peer = io.sockets.sockets.get(target);
    if (!peer || peer.data.claims.cameraId !== claims.cameraId) return;
    if (peer.data.claims.mode === claims.mode) return;
    peer.emit('media:signal', { from: socket.id, fromUserId: claims.sub, data });
  });
  socket.on('media:session:start', async (data = {}) => { await callback('session.started', { ...session, metadata: data }); });
  socket.on('media:session:stop', async () => { await callback('session.stopped', session); socket.disconnect(true); });
  socket.on('disconnect', () => { sessions.delete(socket.id); persist(); });
});

await load();
server.listen(port, () => console.log(`[media-server] listening on ${port}`));
