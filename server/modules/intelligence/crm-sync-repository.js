export function createCrmSyncRepository({ pool, jsonDb, saveJson }) {
  const auditKey = (id) => `crm-sync-audit:${id}`;
  const caseKey = (provider, externalCaseId, sourceVersion = '') => `crm-case:${provider}:${externalCaseId}:${sourceVersion}`;
  const readValues = async (prefix) => {
    if (!pool) {
      jsonDb.crmSync ||= {};
      return Object.entries(jsonDb.crmSync).filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
    }
    return (await pool.query('select value from app_settings where key like $1 order by key', [`${prefix}%`])).rows.map((row) => row.value);
  };
  const saveValue = async (key, value) => {
    if (!pool) { jsonDb.crmSync ||= {}; jsonDb.crmSync[key] = value; saveJson(); return value; }
    await pool.query('insert into app_settings (key,value) values ($1,$2) on conflict (key) do update set value=excluded.value', [key, JSON.stringify(value)]);
    return value;
  };
  return {
    async recordCrmSyncAudit(entry) { return saveValue(auditKey(entry.id), entry); },
    async crmSyncAudit({ provider, action } = {}) { return (await readValues('crm-sync-audit:')).filter((entry) => (!provider || entry.provider === provider) && (!action || entry.action === action)); },
    async findCrmCase({ provider, externalCaseId, sourceVersion = '' } = {}) {
      const values = await readValues(`crm-case:${provider}:${externalCaseId}:`);
      return values.find((value) => !sourceVersion || value.sourceVersion === sourceVersion) || null;
    },
    async saveCrmCase(record) { return saveValue(caseKey(record.provider, record.externalCaseId, record.sourceVersion), record); },
  };
}
