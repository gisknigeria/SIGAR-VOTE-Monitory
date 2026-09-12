import { operationalReportRollupsToCsv } from './repository.js';

const geographyFromQuery = (query) => ({ state: query.state, lga: query.lga, ward: query.ward, pollingUnit: query.pollingUnit });
const reportFilterFromQuery = (query) => ({ ...geographyFromQuery(query), since: query.since, until: query.until, phase: query.phase, electionId: query.electionId, contestId: query.contestId });

export function registerReportingRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store, canAccessGeography }) {
  app.get('/api/reports/operational', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const geography = geographyFromQuery(req.query);
    if (!canAccessGeography(req.user, geography)) return res.status(403).json({ message: 'You are not authorized for this geographic scope.' });
    try {
      const report = await store.operationalReport(reportFilterFromQuery(req.query));
      res.json(report);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }));

  app.get('/api/reports/operational/export', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const geography = geographyFromQuery(req.query);
    if (!canAccessGeography(req.user, geography)) return res.status(403).json({ message: 'You are not authorized for this geographic scope.' });
    if (String(req.query.format || 'csv').toLowerCase() !== 'csv') return res.status(400).json({ message: 'Only the csv export format is currently supported.' });
    try {
      const report = await store.operationalReport(reportFilterFromQuery(req.query));
      const csv = operationalReportRollupsToCsv(report);
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="operational-report-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }));

  app.post('/api/reports/operational/snapshots', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const filter = reportFilterFromQuery(req.body || {});
    if (!canAccessGeography(req.user, geographyFromQuery(req.body || {}))) return res.status(403).json({ message: 'You are not authorized for this geographic scope.' });
    try {
      const snapshot = await store.createReportSnapshot({ filter, requestedBy: req.user.id, label: req.body?.label });
      res.status(201).json(snapshot);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }));

  app.get('/api/reports/operational/snapshots', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const snapshots = await store.reportSnapshots({ requestedBy: req.query.requestedBy, phase: req.query.phase, electionId: req.query.electionId });
    res.json(snapshots.filter((snapshot) => canAccessGeography(req.user, snapshot.filter)));
  }));

  app.get('/api/reports/operational/snapshots/:id', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const snapshot = await store.reportSnapshot(req.params.id);
    if (!snapshot) return res.status(404).json({ message: 'Report snapshot not found.' });
    if (!canAccessGeography(req.user, snapshot.filter)) return res.status(403).json({ message: 'You are not authorized for this geographic scope.' });
    res.json(snapshot);
  }));
}
