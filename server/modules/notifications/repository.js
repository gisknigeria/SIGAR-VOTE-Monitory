
export function createNotificationsRepository({ pool, jsonDb, saveJson, mappers }) {
  const { toNotification } = mappers;
  return {
    async notifications(userId) {
      if (!pool) return (jsonDb.notifications || []).filter(item => item.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { rows } = await pool.query('select * from notifications where user_id=$1 order by created_at desc', [userId]);
      return rows.map(toNotification);
    },
    async createNotification(notification) {
      const dedupeKey = String(notification.dedupeKey || `notification:${notification.id}`).trim();
      const outbox = { id: `outbox-${notification.id}`, dedupeKey, notificationId: notification.id, userId: notification.userId, payload: notification, status: 'pending', attempts: 0, availableAt: notification.createdAt || new Date().toISOString(), deliveredAt: null, lastError: '', createdAt: notification.createdAt || new Date().toISOString(), updatedAt: notification.createdAt || new Date().toISOString() };
      if (!pool) {
        jsonDb.notifications ||= [];
        jsonDb.outbox ||= {};
        if (!jsonDb.outbox[dedupeKey]) {
          jsonDb.notifications.push(notification);
          jsonDb.outbox[dedupeKey] = outbox;
          saveJson();
        }
        return notification;
      }
      const { rows } = await pool.query('insert into notifications (id,user_id,incident_id,room_id,sender_id,message,incident_type,read,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing returning *', [notification.id, notification.userId, notification.incidentId || '', notification.roomId || '', notification.senderId || '', notification.message, notification.incidentType || '', false, notification.createdAt]);
      await pool.query('insert into notification_outbox (id,dedupe_key,notification_id,user_id,payload,status,attempts,available_at,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (dedupe_key) do nothing', [outbox.id, outbox.dedupeKey, outbox.notificationId, outbox.userId, JSON.stringify(outbox.payload), outbox.status, outbox.attempts, outbox.availableAt, outbox.createdAt, outbox.updatedAt]);
      return toNotification(rows[0] || notification);
    },
    async pendingNotificationOutbox({ limit = 50, now = new Date().toISOString() } = {}) {
      if (!pool) return Object.values(jsonDb.outbox || {}).filter((item) => item.status === 'pending' && new Date(item.availableAt).getTime() <= new Date(now).getTime()).slice(0, limit);
      const { rows } = await pool.query('select * from notification_outbox where status=$1 and available_at <= $2 order by created_at limit $3', ['pending', now, limit]);
      return rows.map((row) => ({ ...row, dedupeKey: row.dedupe_key, notificationId: row.notification_id, userId: row.user_id, payload: row.payload, availableAt: row.available_at, createdAt: row.created_at }));
    },
    /** Exact pending count, unlike pendingNotificationOutbox's page-sized (and therefore cappable) result. */
    async countPendingNotificationOutbox({ now = new Date().toISOString() } = {}) {
      if (!pool) return Object.values(jsonDb.outbox || {}).filter((item) => item.status === 'pending' && new Date(item.availableAt).getTime() <= new Date(now).getTime()).length;
      const { rows } = await pool.query('select count(*)::int as count from notification_outbox where status=$1 and available_at <= $2', ['pending', now]);
      return rows[0]?.count ?? 0;
    },
    async markNotificationDelivered(id, deliveredAt = new Date().toISOString()) {
      if (!pool) { const item = Object.values(jsonDb.outbox || {}).find((value) => value.id === id); if (item) { item.status = 'delivered'; item.deliveredAt = deliveredAt; item.updatedAt = deliveredAt; saveJson(); } return item; }
      const { rows } = await pool.query('update notification_outbox set status=$2,delivered_at=$3,updated_at=$3 where id=$1 returning *', [id, 'delivered', deliveredAt]);
      return rows[0] || null;
    },
    async markNotificationRetry(id, error, { now = new Date().toISOString(), maxAttempts = 8 } = {}) {
      if (!pool) { const item = Object.values(jsonDb.outbox || {}).find((value) => value.id === id); if (item) { item.attempts += 1; item.status = item.attempts >= maxAttempts ? 'failed' : 'pending'; item.lastError = String(error?.message || error || 'delivery failed').slice(0, 500); item.availableAt = new Date(Date.now() + Math.min(60 * 60_000, 1000 * 2 ** item.attempts)).toISOString(); item.updatedAt = now; saveJson(); } return item; }
      const { rows } = await pool.query('update notification_outbox set attempts=attempts+1,status=case when attempts+1 >= $2 then $3 else $4 end,last_error=$5,available_at=$6,updated_at=$7 where id=$1 returning *', [id, maxAttempts, 'failed', 'pending', String(error?.message || error || 'delivery failed').slice(0, 500), new Date(Date.now() + Math.min(60 * 60_000, 1000 * 2 ** 1)).toISOString(), now]);
      return rows[0] || null;
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
  };
}
