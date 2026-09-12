export function registerConnectivityRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store }) {
  app.post('/api/connectivity/datasets', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try { res.status(201).json(await store.ingestConnectivityDataset({ ...req.body, ingestedBy: req.user.id })); }
    catch (error) { res.status(400).json({ message: error.message }); }
  }));
  app.post('/api/connectivity/datasets/:id/approve', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try { res.json(await store.approveConnectivityDataset(req.params.id, { approvedBy: req.user.id })); }
    catch (error) { res.status(400).json({ message: error.message }); }
  }));
  app.get('/api/connectivity/datasets', auth, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.connectivityDatasets({ provider: req.query.provider, resolution: req.query.resolution, status: 'approved' }));
  }));
  app.get('/api/connectivity/analysis', auth, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.connectivityAnalysis({ geography: { state: req.query.state, lga: req.query.lga, ward: req.query.ward, pollingUnit: req.query.pollingUnit } }));
  }));
}
