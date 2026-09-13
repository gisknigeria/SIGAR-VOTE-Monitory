import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

/**
 * Socket.IO keeps its room membership and broadcast routing inside a single process. Without a
 * shared adapter, a second instance does not scale the realtime layer -- it breaks it: an agent
 * connected to instance A and an administrator on instance B never see each other's events, and
 * the failure is silent on both sides.
 *
 * Attaching the Redis adapter lets every instance publish and receive broadcasts through Redis,
 * so rooms behave as if there were one process.
 *
 * Without REDIS_URL this is a no-op and the server runs exactly as a single process -- which is
 * correct for one instance. When REDIS_URL *is* set, the operator is declaring a cluster, so a
 * connection failure throws rather than quietly degrading to a broken multi-instance setup.
 */
export async function attachRealtimeCluster(io, { redisUrl = process.env.REDIS_URL, startupTimeoutMs = 10_000 } = {}) {
  const url = String(redisUrl || '').trim();
  if (!url) {
    console.warn(
      '[realtime] REDIS_URL is not set: running single-process. Live video, GPS and chat will not work correctly across more than one instance.',
    );
    return { enabled: false, close: async () => {} };
  }

  // The client's default reconnect strategy retries forever, so a wrong URL would hang startup
  // indefinitely instead of failing. Back off, but give up on the initial connect -- and once we
  // have abandoned the attempt, stop reconnecting entirely rather than leaving a retry loop
  // running behind a rejected promise.
  let abandoned = false;
  const clientOptions = {
    url,
    socket: {
      connectTimeout: startupTimeoutMs,
      reconnectStrategy: (retries) =>
        abandoned || retries > 20 ? new Error('Redis is unreachable') : Math.min(200 * 2 ** retries, 3_000),
    },
  };
  const pubClient = createClient(clientOptions);
  const subClient = pubClient.duplicate();
  // Without a listener a client error is an unhandled 'error' event, which takes the process down.
  pubClient.on('error', (error) => console.error('[realtime] Redis publisher error:', error.message));
  subClient.on('error', (error) => console.error('[realtime] Redis subscriber error:', error.message));

  const shutdown = async () => {
    abandoned = true;
    await Promise.allSettled([
      pubClient.destroy ? pubClient.destroy() : pubClient.disconnect(),
      subClient.destroy ? subClient.destroy() : subClient.disconnect(),
    ]);
  };

  try {
    await Promise.race([
      Promise.all([pubClient.connect(), subClient.connect()]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`no connection within ${startupTimeoutMs}ms`)), startupTimeoutMs).unref?.(),
      ),
    ]);
  } catch (error) {
    await shutdown();
    throw new Error(
      `REDIS_URL is set but the realtime cluster could not connect (${error.message}). Refusing to start: a multi-instance deployment without a shared adapter silently drops events between instances.`,
    );
  }

  io.adapter(createAdapter(pubClient, subClient));
  console.log('[realtime] Redis adapter attached: realtime events are shared across instances.');

  return {
    enabled: true,
    close: async () => {
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
    },
  };
}
