export function startTaskWorker({ store, emitNotification, intervalMs = 30_000, logger = console }) {
  let running = null;
  const runOnce = async () => {
    if (running) return running;
    running = (async () => {
      try {
      const process = async (workerStore) => {
        const escalations = workerStore.processOverdueTasks
          ? await workerStore.processOverdueTasks({ createNotification: workerStore.createNotification })
          : [];
        const pending = await workerStore.pendingNotificationOutbox();
        for (const item of pending) {
          try {
            emitNotification(item.payload);
            await workerStore.markNotificationDelivered(item.id);
          } catch (error) {
            await workerStore.markNotificationRetry(item.id, error);
          }
        }
        return { escalations, delivered: pending.length };
      };
        return await (store.withTransaction ? store.withTransaction(process) : process(store));
      } catch (error) {
        logger.error?.('[task-worker] processing failed:', error.message);
        return { escalations: [], delivered: 0, error };
      } finally { running = null; }
    })();
    return running;
  };
  const timer = setInterval(runOnce, intervalMs);
  timer.unref?.();
  runOnce();
  return { runOnce, stop: () => clearInterval(timer) };
}