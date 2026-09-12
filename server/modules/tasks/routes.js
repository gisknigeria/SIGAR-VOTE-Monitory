import { normalizeSyncEnvelope, syncConflictResponse } from '../foundation/sync-contract.js';

export function registerTaskRoutes({ app, auth, rateLimit, asyncRoute, store }) {
  app.get('/api/tasks', auth, rateLimit, asyncRoute(async (req, res) => {
    const tasks = await store.tasks({ ownerId: req.user.role === 'Admin' || req.user.role === 'Super Admin' ? req.query.ownerId : req.user.id, incidentId: req.query.incidentId, decisionId: req.query.decisionId, status: req.query.status });
    res.json(tasks);
  }));
  app.post('/api/tasks', auth, rateLimit, asyncRoute(async (req, res) => {
    try {
      const task = await store.createTask({ ...req.body, createdBy: req.user.id });
      res.status(201).json(task);
    } catch (error) { res.status(400).json({ message: error.message }); }
  }));
  app.post('/api/tasks/:id/acknowledge', auth, rateLimit, asyncRoute(async (req, res) => {
    try {
      const sync = normalizeSyncEnvelope({ ...req.body, submissionId: req.body.submissionId || req.body.id || `task-ack-${req.params.id}-${req.user.id}`, captureTime: req.body.captureTime || new Date().toISOString() }, 'task-ack');
      if (!sync.payloadHash && store.hashPayload) sync.payloadHash = store.hashPayload({ taskId: req.params.id, action: 'acknowledge', captureTime: sync.captureTime });
      res.json(await store.acknowledgeTask(req.params.id, { actorId: req.user.id, sync }));
    } catch (error) { res.status(error.code === 'SYNC_CONFLICT' ? 409 : 403).json(error.code === 'SYNC_CONFLICT' ? syncConflictResponse(error) : { message: error.message }); }
  }));
  app.post('/api/tasks/:id/complete', auth, rateLimit, asyncRoute(async (req, res) => {
    try { res.json(await store.completeTask(req.params.id, { actorId: req.user.id, responseEvidence: req.body.responseEvidence })); }
    catch (error) { res.status(400).json({ message: error.message }); }
  }));
}