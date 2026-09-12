
export function registerNotificationRoutes({ app, auth, rateLimit, asyncRoute, store }) {
  app.get(
    "/api/notifications",
    auth,
    rateLimit,
    asyncRoute(async (req, res) =>
      res.json(await store.notifications(req.user.id)),
    ),
  );
  app.put(
    "/api/notifications/:id/read",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const owned = (await store.notifications(req.user.id)).find(
        (item) => item.id === req.params.id,
      );
      if (!owned)
        return res.status(404).json({ message: "Notification not found" });
      res.json(await store.markNotificationAsRead(req.params.id));
    }),
  );
  app.delete(
    "/api/notifications/:id",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const owned = (await store.notifications(req.user.id)).some(
        (item) => item.id === req.params.id,
      );
      if (!owned)
        return res.status(404).json({ message: "Notification not found" });
      await store.deleteNotification(req.params.id);
      res.status(204).end();
    }),
  );

}
