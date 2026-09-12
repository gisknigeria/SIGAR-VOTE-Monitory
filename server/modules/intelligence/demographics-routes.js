export function registerDemographicsRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store }) {
  app.post('/api/demographics/datasets', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try { res.status(201).json(await store.ingestDemographicDataset({ ...req.body, ingestedBy: req.user.id })); }
    catch (error) { res.status(400).json({ message: error.message }); }
  }));
  app.post('/api/demographics/datasets/:id/approve', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try { res.json(await store.approveDemographicDataset(req.params.id, { approvedBy: req.user.id })); }
    catch (error) { res.status(400).json({ message: error.message }); }
  }));
  app.get('/api/demographics/datasets', auth, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.demographicDatasets({ metric: req.query.metric, resolution: req.query.resolution, status: 'approved' }));
  }));
  app.get('/api/demographics/analysis', auth, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.demographicAnalysis({ geography: { state: req.query.state, lga: req.query.lga, ward: req.query.ward, pollingUnit: req.query.pollingUnit }, populationDatasetId: req.query.populationDatasetId, registeredVotersDatasetId: req.query.registeredVotersDatasetId }));
  }));
}
