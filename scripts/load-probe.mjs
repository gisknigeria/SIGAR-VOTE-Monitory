// Directional load probe against a locally spawned instance of this backend in
// JSON-store mode. This is NOT a production capacity test: no Postgres, no
// realistic data volume, no network latency, and one machine running both the
// load generator and the server under test. Use it to catch an obvious
// regression between changes, not to size production infrastructure -- see
// docs/CTO-Resource-and-Readiness-Brief.md for what a real capacity test needs
// (workload model, realistic data volume, isolated load generator, managed
// Postgres, measured p95/p99 under sustained concurrency).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONCURRENCY = Number(process.argv[2] || 20);
const REQUESTS_PER_ROUTE = Number(process.argv[3] || 200);

const directory = mkdtempSync(join(tmpdir(), 'oyo-load-probe-'));
const child = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', DATA_FILE: join(directory, 'data.json'), PORT: '0', JWT_SECRET: 'load-probe-secret-'.repeat(3), SUPER_ADMIN_EMAIL: 'superadmin@command.local', SUPER_ADMIN_PASSWORD: 'LoadProbe!2026Strong', ADMIN_PASSWORD: 'LoadProbe!2026Strong', IREV_AUTO_SYNC: 'false', IREV_OYO_ELECTION_ID: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = ''; child.stdout.on('data', (d) => { logs += d; }); child.stderr.on('data', (d) => { logs += d; });

async function waitForHealth(base) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become healthy\n${logs}`);
}

async function probeRoute(label, run) {
  const durations = [];
  let inFlight = 0;
  let completed = 0;
  await new Promise((resolve, reject) => {
    const launch = () => {
      if (completed >= REQUESTS_PER_ROUTE) { if (inFlight === 0) resolve(); return; }
      completed += 1;
      inFlight += 1;
      const start = process.hrtime.bigint();
      run().then(() => {
        durations.push(Number(process.hrtime.bigint() - start) / 1e6);
        inFlight -= 1;
        launch();
      }).catch(reject);
    };
    for (let i = 0; i < CONCURRENCY; i += 1) launch();
  });
  durations.sort((a, b) => a - b);
  const avg = durations.reduce((sum, v) => sum + v, 0) / durations.length;
  const p95 = durations[Math.floor(durations.length * 0.95)];
  console.log(`${label.padEnd(32)} n=${durations.length} concurrency=${CONCURRENCY} avg=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms min=${durations[0].toFixed(2)}ms max=${durations[durations.length - 1].toFixed(2)}ms`);
}

const port = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Startup timed out\n${logs}`)), 15000);
  const check = () => {
    const match = logs.match(/listening on port (\d+)/);
    if (match) { clearTimeout(timer); resolve(match[1]); return; }
    setTimeout(check, 100);
  };
  child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}\n${logs}`)); });
  check();
});

const base = `http://127.0.0.1:${port}`;
await waitForHealth(base);

try {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'superadmin@command.local', password: 'LoadProbe!2026Strong' }) });
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };

  console.log(`\nLoad probe (JSON-store mode, this machine, concurrency=${CONCURRENCY}, ${REQUESTS_PER_ROUTE} requests/route):`);
  await probeRoute('GET /api/health (no auth)', () => fetch(`${base}/api/health`).then((r) => r.arrayBuffer()));
  await probeRoute('POST /api/auth/login', () => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'superadmin@command.local', password: 'LoadProbe!2026Strong' }) }).then((r) => r.arrayBuffer()));
  await probeRoute('GET /api/incidents', () => fetch(`${base}/api/incidents`, { headers }).then((r) => r.arrayBuffer()));
  await probeRoute('GET /api/geography/operational-view', () => fetch(`${base}/api/geography/operational-view`, { headers }).then((r) => r.arrayBuffer()));
  await probeRoute('GET /api/reports/operational', () => fetch(`${base}/api/reports/operational`, { headers }).then((r) => r.arrayBuffer()));
} finally {
  child.kill();
  await new Promise((resolve) => (child.exitCode !== null ? resolve() : child.once('exit', resolve)));
  rmSync(directory, { recursive: true, force: true });
}
