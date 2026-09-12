
const ADMIN_CAPABLE_ROLES = ['Super Admin', 'Admin', 'Supervisor'];
const DAY_MS = 86_400_000;

export function createIdentityRepository({ pool, jsonDb, saveJson, mappers }) {
  const { toUser } = mappers;
  const reviewKey = (userId) => `access-review:${userId}`;
  const readAccessReviews = async () => {
    if (!pool) { jsonDb.accessReviews ||= {}; return jsonDb.accessReviews; }
    const { rows } = await pool.query("select key, value from app_settings where key like 'access-review:%'");
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  };
  return {
    async users() {
      if (!pool) return jsonDb.users;
      const { rows } = await pool.query('select * from users order by role, name');
      return rows.map(toUser);
    },
    async userByEmail(email) {
      if (!pool) return jsonDb.users.find(user => user.email.toLowerCase() === email.toLowerCase() && user.active);
      const { rows } = await pool.query('select * from users where lower(email)=lower($1) and active=true limit 1', [email]);
      return toUser(rows[0]);
    },
    async createUser(user) {
      if (!pool) { jsonDb.users.push(user); saveJson(); return user; }
      const { rows } = await pool.query('insert into users (id,name,email,password,role,rank,active,unit,unit_type,command,division,station,state,lga,ward,polling_unit,lat,lng) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning *', [user.id, user.name, user.email, user.password, user.role, user.rank, user.active, user.unit, user.unitType || 'Division', user.command, user.division, user.station || '', user.state || '', user.lga, user.ward || '', user.pollingUnit || '', user.lat, user.lng]);
      return toUser(rows[0]);
    },
    async updateUserPassword(id, password) {
      if (!pool) { const user = jsonDb.users.find(item => item.id === id); if (!user) return null; user.password = password; saveJson(); return user; }
      const { rows } = await pool.query('update users set password=$2 where id=$1 returning *', [id, password]);
      return toUser(rows[0]);
    },
    async updateUserProfile(id, changes) {
      if (!pool) { const user = jsonDb.users.find(item => item.id === id); if (!user) return null; const { password, ...profile } = changes; Object.assign(user, profile); if (password) user.password = password; saveJson(); return user; }
      const { rows } = await pool.query('update users set name=$2,email=$3,station=$4,password=coalesce($5,password) where id=$1 returning *', [id, changes.name, changes.email, changes.station, changes.password || null]);
      return toUser(rows[0]);
    },
    async updateUser(id, changes) {
      if (!pool) { const user = jsonDb.users.find(item => item.id === id); if (!user) return null; Object.assign(user, changes); saveJson(); return user; }
      const keyMap = { unitType: 'unit_type', pollingUnit: 'polling_unit' };
      const columns = [];
      const values = [id];
      let parameter = 2;
      for (const [key, value] of Object.entries(changes)) {
        if (key === 'id' || key === 'password') continue;
        columns.push(`${keyMap[key] || key}=$${parameter}`);
        values.push(value);
        parameter += 1;
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

    /** Records that an administrator/supervisor account's access was reviewed today. */
    async recordAccessReview(userId, { reviewedBy = '', notes = '' } = {}) {
      const id = String(userId || '').trim();
      if (!id) throw new Error('An account is required to record an access review.');
      if (!String(reviewedBy || '').trim()) throw new Error('An authenticated reviewer is required.');
      const record = { userId: id, reviewedBy: String(reviewedBy).trim(), reviewedAt: new Date().toISOString(), notes: String(notes || '').trim() };
      if (!pool) { jsonDb.accessReviews ||= {}; jsonDb.accessReviews[reviewKey(id)] = record; saveJson(); return record; }
      await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [reviewKey(id), JSON.stringify(record)]);
      return record;
    },

    /**
     * Real, queryable enforcement of the access-review cadence policy (rather than
     * only the cadenceDays number sitting unused): every Admin-capable account with
     * no review, or one older than cadenceDays, is reported overdue.
     */
    async accessReviewStatus({ cadenceDays = 90 } = {}) {
      const reviews = await readAccessReviews();
      const now = Date.now();
      const cadenceMs = Math.max(1, Number(cadenceDays) || 90) * DAY_MS;
      return (await this.users())
        .filter((user) => ADMIN_CAPABLE_ROLES.includes(user.role) && user.active)
        .map((user) => {
          const review = reviews[reviewKey(user.id)];
          const lastReviewedAt = review?.reviewedAt || null;
          const referenceTime = lastReviewedAt ? Date.parse(lastReviewedAt) : Date.parse(user.createdAt || '') || null;
          const overdue = referenceTime === null || (now - referenceTime) > cadenceMs;
          return { userId: user.id, name: user.name, role: user.role, lastReviewedAt, lastReviewedBy: review?.reviewedBy || '', overdue };
        });
    },
  };
}
