import { recordAudit } from './audit-helper.js';

export function registerEvidenceRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store }) {
  app.get('/api/evidence/:id', auth, rateLimit, asyncRoute(async (req, res) => {
    try {
      const evidence = await store.readPrivateEvidence(req.params.id, req.user);
      if (!evidence) return res.status(404).json({ message: 'Evidence not found.' });
      await recordAudit(store, req, { action: 'evidence.accessed', entityType: 'evidence', entityId: evidence.id, source: 'access-control' });
      res.json({ id: evidence.id, data: evidence.originalData, mimeType: evidence.mimeType, hash: evidence.hash, custody: evidence.custody, malwareScan: evidence.malwareScan, retention: evidence.retention });
    } catch (error) {
      if (error.code === 'EVIDENCE_ACCESS_DENIED') {
        await recordAudit(store, req, { action: 'evidence.access_denied', entityType: 'evidence', entityId: req.params.id, status: 'denied', source: 'access-control' });
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  }));
  app.post('/api/evidence/:id/access', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const evidence = await store.grantEvidenceAccess(req.params.id, { actorId: req.user.id, userIds: Array.isArray(req.body.userIds) ? req.body.userIds : [], reason: req.body.reason });
    if (!evidence) return res.status(404).json({ message: 'Evidence not found.' });
    await recordAudit(store, req, { action: 'evidence.access_granted', entityType: 'evidence', entityId: evidence.id, details: { userIds: req.body.userIds, reason: req.body.reason }, source: 'access-control' });
    res.json({ id: evidence.id, access: evidence.access, custody: evidence.custody });
  }));
  app.post('/api/evidence/:id/legal-hold', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const held = req.body.held !== false;
    const evidence = await store.setEvidenceLegalHold(req.params.id, { actor: req.user, held, reason: req.body.reason });
    if (!evidence) return res.status(404).json({ message: 'Evidence not found.' });
    await recordAudit(store, req, { action: held ? 'evidence.legal_hold_applied' : 'evidence.legal_hold_released', entityType: 'evidence', entityId: evidence.id, details: { reason: req.body.reason } });
    res.json({ id: evidence.id, retention: evidence.retention, custody: evidence.custody });
  }));
  app.delete('/api/evidence/:id', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try {
      const evidence = await store.deleteEvidence(req.params.id, req.user);
      if (!evidence) return res.status(404).json({ message: 'Evidence not found.' });
      await recordAudit(store, req, { action: 'evidence.deleted', entityType: 'evidence', entityId: req.params.id });
      res.status(204).end();
    } catch (error) {
      if (error.code === 'EVIDENCE_ACCESS_DENIED') return res.status(403).json({ message: error.message });
      res.status(409).json({ message: error.message });
    }
  }));
  // Manually triggered enforcement: there is no automatic scheduler in this codebase, so
  // an operator (or an external cron hitting this endpoint) must invoke retention deletion.
  app.post('/api/evidence/retention/sweep', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    if (req.user.role !== 'Super Admin') return res.status(403).json({ message: 'Only a Super Admin may run the evidence retention sweep.' });
    const result = await store.sweepExpiredEvidence({ actorId: req.user.id });
    await recordAudit(store, req, { action: 'evidence.retention_swept', entityType: 'evidence', details: result });
    res.json(result);
  }));
}
