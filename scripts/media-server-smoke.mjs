// Real, controlled-fixture integration test for the standalone media service
// (server/modules/foundation/... never talks to it directly at the HTTP layer;
// only the election API's short-lived JWT contract does). No live WebRTC/video
// infrastructure is needed: this exercises the actual recording lifecycle HTTP
// contract (create -> chunk -> offset-conflict -> finalize -> revoke) against a
// real spawned instance of media-server/index.js, using a locally-signed token
// with the same shared secret the service verifies.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const directory = mkdtempSync(join(tmpdir(), 'oyo-media-smoke-'));
const secret = 'media-smoke-shared-secret-'.repeat(2);
const port = 18787;
const stateFile = join(directory, 'media-state.json');
const uploadDir = join(directory, 'uploads');

const sign = (claims, options = {}) => jwt.sign(claims, secret, { algorithm: 'HS256', issuer: 'sigar-election-api', audience: 'sigar-media-service', expiresIn: '2m', ...options });

const child = spawn(process.execPath, ['media-server/index.js'], {
  env: { ...process.env, MEDIA_PORT: String(port), MEDIA_SERVICE_SHARED_SECRET: secret, MEDIA_STATE_FILE: stateFile, MEDIA_UPLOAD_DIR: uploadDir, MEDIA_API_CALLBACK_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = ''; child.stdout.on('data', (d) => { logs += d; }); child.stderr.on('data', (d) => { logs += d; });

const base = `http://127.0.0.1:${port}`;
try {
  let exited = null;
  child.once('exit', (code) => { exited = code; });
  const deadline = Date.now() + 15000;
  let ready = false;
  while (Date.now() < deadline) {
    if (exited !== null) throw new Error(`Server exited ${exited} before becoming ready\n${logs}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) { ready = true; break; }
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error(`Startup timed out\n${logs}`);

  assert.equal((await (await fetch(`${base}/health`)).json()).ok, true);

  const noAuth = await fetch(`${base}/v1/recordings`, { method: 'POST', body: '{}' });
  assert.equal(noAuth.status, 401, 'a recording endpoint must reject a missing/invalid token');

  const publishToken = sign({ sub: 'agent-1', cameraId: 'cam-1', mode: 'publish', scope: ['camera:cam-1:publish'], jti: 'jti-1' });
  const viewToken = sign({ sub: 'viewer-1', cameraId: 'cam-1', mode: 'view', scope: ['camera:cam-1:view'], jti: 'jti-2' });
  const wrongCameraToken = sign({ sub: 'agent-2', cameraId: 'cam-2', mode: 'publish', scope: ['camera:cam-2:publish'], jti: 'jti-3' });

  const viewCannotRecord = await fetch(`${base}/v1/recordings`, { method: 'POST', headers: { authorization: `Bearer ${viewToken}` }, body: '{}' });
  assert.equal(viewCannotRecord.status, 403, 'a view-scoped token must not be able to start a recording');

  const createRecording = await fetch(`${base}/v1/recordings`, { method: 'POST', headers: { authorization: `Bearer ${publishToken}` }, body: JSON.stringify({ source: 'webrtc-session' }) });
  assert.equal(createRecording.status, 201, await createRecording.clone().text());
  const recording = await createRecording.json();
  assert.equal(recording.status, 'recording');
  assert.equal(recording.cameraId, 'cam-1');

  const crossCameraAccess = await fetch(`${base}/v1/recordings/${recording.id}/chunks`, { method: 'POST', headers: { authorization: `Bearer ${wrongCameraToken}` }, body: JSON.stringify({ offset: 0, chunkBase64: Buffer.from('x').toString('base64') }) });
  assert.equal(crossCameraAccess.status, 404, 'a token for a different camera/owner must not see this recording');

  const firstChunk = Buffer.from('first-chunk-bytes');
  const chunkOne = await fetch(`${base}/v1/recordings/${recording.id}/chunks`, { method: 'POST', headers: { authorization: `Bearer ${publishToken}` }, body: JSON.stringify({ offset: 0, chunkBase64: firstChunk.toString('base64') }) });
  assert.equal(chunkOne.status, 200, await chunkOne.clone().text());
  const chunkOneBody = await chunkOne.json();
  assert.equal(chunkOneBody.nextOffset, firstChunk.length);

  const wrongOffset = await fetch(`${base}/v1/recordings/${recording.id}/chunks`, { method: 'POST', headers: { authorization: `Bearer ${publishToken}` }, body: JSON.stringify({ offset: 0, chunkBase64: Buffer.from('replayed').toString('base64') }) });
  assert.equal(wrongOffset.status, 409);
  assert.equal((await wrongOffset.json()).code, 'UPLOAD_OFFSET_CONFLICT');

  const secondChunk = Buffer.from('second-chunk-bytes');
  const chunkTwo = await fetch(`${base}/v1/recordings/${recording.id}/chunks`, { method: 'POST', headers: { authorization: `Bearer ${publishToken}` }, body: JSON.stringify({ offset: firstChunk.length, chunkBase64: secondChunk.toString('base64') }) });
  assert.equal(chunkTwo.status, 200, await chunkTwo.clone().text());

  const stop = await fetch(`${base}/v1/recordings/${recording.id}/stop`, { method: 'POST', headers: { authorization: `Bearer ${publishToken}` }, body: '{}' });
  assert.equal(stop.status, 202);
  assert.equal((await stop.json()).status, 'processing');

  const finalize = await fetch(`${base}/v1/recordings/${recording.id}/finalize`, { method: 'POST', headers: { authorization: `Bearer ${publishToken}` }, body: JSON.stringify({ sha256: 'deadbeef' }) });
  assert.equal(finalize.status, 200, await finalize.clone().text());
  const finalized = await finalize.json();
  assert.equal(finalized.status, 'finalized');
  assert.equal(finalized.sha256, 'deadbeef');

  const revoke = await fetch(`${base}/v1/sessions/revoke`, { method: 'POST', headers: { authorization: `Bearer ${publishToken}` }, body: JSON.stringify({ jti: 'jti-1' }) });
  assert.equal(revoke.status, 204);
  const revokedAttempt = await fetch(`${base}/v1/recordings`, { method: 'POST', headers: { authorization: `Bearer ${publishToken}` }, body: '{}' });
  assert.equal(revokedAttempt.status, 401, 'a revoked token must be rejected even before its natural expiry');

  const persisted = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.ok(persisted.recordings.some((item) => item.id === recording.id && item.status === 'finalized'), 'recording lifecycle state must survive as durable state, not only in memory');

  console.log('Media-server smoke passed: health, auth rejection, mode/camera scoping, resumable chunk upload with offset-conflict detection, finalize, token revocation, and durable state persistence.');
} finally {
  child.kill();
  await new Promise((resolve) => (child.exitCode !== null ? resolve() : child.once('exit', resolve)));
  rmSync(directory, { recursive: true, force: true });
}
