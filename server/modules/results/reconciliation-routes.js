export function registerReconciliationRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store }) {
  app.post('/api/results/reconciliation', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try { res.status(201).json(await store.reconcileResults(req.body)); }
    catch (error) { res.status(400).json({ message: error.message }); }
  }));
  app.get('/api/results/reconciliation', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.resultReconciliations({ status: req.query.status, pollingUnit: req.query.pollingUnit }));
  }));
  app.post('/api/results/reconciliation/:id/review', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    try { res.json(await store.reviewReconciliation(req.params.id, { ...req.body, reviewerId: req.user.id })); }
    catch (error) { res.status(400).json({ message: error.message }); }
  }));
  app.get('/api/results/reconciliation/:id/corrections', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    res.json(await store.resultCorrections(req.params.id));
  }));
}