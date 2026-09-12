/**
 * Records one durable audit event for a sensitive mutation (identity, access,
 * reference approvals, incidents, decisions, evidence access, integrations).
 * A missing store capability is treated as "no audit backend wired" rather
 * than a hard failure, so this can be called from any route without an extra
 * capability check at every call site.
 */
export async function recordAudit(store, req, { action, entityType = 'record', entityId = '', details = {}, geography = null, source = 'system', status = 'logged' } = {}) {
  if (!store?.appendAuditEntry || !store?.createAuditEntry) return null;
  const entry = store.createAuditEntry({
    actorId: req?.user?.id || '',
    actorRole: req?.user?.role || '',
    action,
    entityType,
    entityId,
    details,
    geography,
    source,
    status,
  });
  return store.appendAuditEntry(entry);
}
