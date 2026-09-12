export function registerAuditRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store }) {
  app.get('/api/audit', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const page = await store.auditEvents({
      actorId: req.query.actorId,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      since: req.query.since,
      until: req.query.until,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(page);
  }));
}
