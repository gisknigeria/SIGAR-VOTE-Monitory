import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import bcrypt from 'bcryptjs';
import { aggregateAgents } from '../shared/areaAnalysis.js';

if (!isMainThread) {
  const results = [];
  for (const user of workerData.users) {
    results.push({ ...user, password: bcrypt.hashSync(workerData.password, 10) });
    if (results.length % 100 === 0) parentPort.postMessage({ progress: 100 });
  }
  parentPort.postMessage({ users: results, progress: results.length % 100 });
} else {
  if (process.env.DATABASE_URL) throw new Error('This importer is for the local JSON store only. DATABASE_URL is configured.');
  if (!process.argv.includes('--apply')) throw new Error('Pass --apply to create the validated accounts.');
  const root = path.resolve('server');
  const dataPath = path.resolve(process.env.DATA_FILE || path.join(root, 'data.json'));
  if (dataPath !== path.join(root, 'data.json')) throw new Error('Unexpected target: only this workspace server/data.json is supported.');
  const folder = path.join(root, 'agent-imports');
  const source = JSON.parse(fs.readFileSync(path.join(folder, 'prepared.json'), 'utf8'));
  const password = process.env.AGENT_IMPORT_PASSWORD;
  if (!password) throw new Error('AGENT_IMPORT_PASSWORD is required.');
  const listening = await new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: Number(process.env.PORT || 5000) });
    socket.setTimeout(1500);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(true); });
  });
  if (listening) throw new Error('Stop the local API before importing to avoid overwriting its in-memory store.');
  const original = fs.readFileSync(dataPath);
  const checksum = value => createHash('sha256').update(value).digest('hex');
  const database = JSON.parse(original);
  const byId = new Map(database.users.map(user => [user.id, user]));
  const byEmail = new Map(database.users.map(user => [user.email.toLowerCase(), user]));
  const toCreate = [];
  for (const sourceUser of source.users) {
    const existing = byId.get(sourceUser.id);
    if (existing) {
      if (existing.email !== sourceUser.email) throw new Error('An existing import ID has a different login. Review before changing accounts.');
      continue;
    }
    if (byEmail.has(sourceUser.email)) throw new Error('An existing account uses an import login. No accounts were changed.');
    const { loginId, preferredLogin, importSource, importWarnings, ...user } = sourceUser;
    toCreate.push(user);
  }
  console.log(JSON.stringify({ target: 'Local workspace database', newAccounts: toCreate.length, existingAccounts: database.users.length }));
  let completed = 0;
  let lastReported = 0;
  const chunks = Array.from({ length: Math.min(4, Math.max(1, toCreate.length)) }, () => []);
  toCreate.forEach((user, index) => chunks[index % chunks.length].push(user));
  const results = await Promise.all(chunks.map(users => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { users, password } });
    worker.on('message', message => {
      completed += message.progress || 0;
      if (completed - lastReported >= 500 || completed === toCreate.length) { console.log(`Prepared ${completed}/${toCreate.length} password hashes`); lastReported = completed; }
      if (message.users) resolve(message.users);
    });
    worker.on('error', reject);
    worker.on('exit', code => { if (code !== 0) reject(new Error(`Password worker exited with ${code}`)); });
  })));
  const created = results.flat();
  if (created.length !== toCreate.length) throw new Error('Import count mismatch. Nothing was saved.');
  if (checksum(fs.readFileSync(dataPath)) !== checksum(original)) throw new Error('The database changed during preparation. Nothing was overwritten.');
  const backup = path.join(folder, `before-import-${Date.now()}.json`);
  fs.writeFileSync(backup, original, { flag: 'wx' });
  database.users.push(...created);
  const temporary = `${dataPath}.import-tmp`;
  fs.writeFileSync(temporary, JSON.stringify(database, null, 2), { flag: 'wx' });
  fs.renameSync(temporary, dataPath);
  const saved = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const counts = aggregateAgents(saved.users);
  const report = { ...source.summary, created: created.length, alreadyPresent: source.users.length - created.length, totalDatabaseUsers: saved.users.length, mapAgentTotal: counts.total, completedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(folder, 'import-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
