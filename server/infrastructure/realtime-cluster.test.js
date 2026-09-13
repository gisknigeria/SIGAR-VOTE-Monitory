import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRealtimeCluster } from './realtime-cluster.js';

function fakeIo() {
  return { adapterCalls: 0, adapter() { this.adapterCalls += 1; } };
}

test('without REDIS_URL the server stays single-process and installs no adapter', async () => {
  const io = fakeIo();
  const cluster = await attachRealtimeCluster(io, { redisUrl: '' });
  assert.equal(cluster.enabled, false);
  assert.equal(io.adapterCalls, 0, 'a single instance must not need Redis');
  await cluster.close();
});

test('a configured but unreachable Redis refuses to start rather than degrading silently', async () => {
  const io = fakeIo();
  // Port 1 is reserved and never listening, so this exercises the real connection failure path.
  // The short timeout also proves startup cannot hang: the client's own default reconnect
  // strategy retries forever, which would stall a deploy instead of failing it.
  await assert.rejects(
    attachRealtimeCluster(io, { redisUrl: 'redis://127.0.0.1:1', startupTimeoutMs: 1_500 }),
    /could not connect|Refusing to start/,
  );
  assert.equal(io.adapterCalls, 0, 'a failed cluster must never leave a half-attached adapter');
});
