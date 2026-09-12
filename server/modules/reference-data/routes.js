import { recordAudit } from '../foundation/audit-helper.js';

export function registerReferenceDataRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store }) {
  app.post('/api/reference-data/ingest', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try {
      const release = await store.ingestReferenceData({ ...req.body, ingestedBy: req.user.id });
      await recordAudit(store, req, { action: 'reference_data.ingested', entityType: 'reference_release', entityId: release.id, details: { sourceId: release.sourceId, sourceVersion: release.sourceVersion, classification: release.classification, recordCount: release.recordCount } });
      return res.status(201).json(release);
    } catch (error) { return res.status(400).json({ message: error.message }); }
  }));
  app.post('/api/reference-data/releases/:id/approve', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try {
      const release = await store.approveReferenceData(req.params.id, { approvedBy: req.user.id, approvedByRole: req.user.role });
      await recordAudit(store, req, { action: 'reference_data.approved', entityType: 'reference_release', entityId: release.id, details: { sourceId: release.sourceId, sourceVersion: release.sourceVersion, validRecordCount: release.validRecordCount } });
      return res.json(release);
    } catch (error) { return res.status(400).json({ message: error.message }); }
  }));
  app.get('/api/reference-data/releases', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.referenceDataReleases({ sourceId: req.query.sourceId, classification: req.query.classification, status: req.query.status }));
  }));
  app.get('/api/reference-data/active', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.activeReferenceData({ sourceId: req.query.sourceId, classification: req.query.classification }));
  }));
}
