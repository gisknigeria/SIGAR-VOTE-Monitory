import { buildGeographicOperationalView, GeographyAccessDeniedError } from './operational-view.js';

export function registerOperationalViewRoutes({ app, auth, rateLimit, asyncRoute, store, canAccessGeography }) {
  app.get('/api/geography/operational-view', auth, rateLimit, asyncRoute(async (req, res) => {
    try {
      const view = await buildGeographicOperationalView({
        store,
        actor: req.user,
        canAccessGeography,
        scope: { state: req.query.state, lga: req.query.lga, ward: req.query.ward, pollingUnit: req.query.pollingUnit },
        limit: req.query.limit,
        offset: req.query.offset,
      });
      res.json(view);
    } catch (error) {
      if (error instanceof GeographyAccessDeniedError) return res.status(403).json({ message: error.message });
      return res.status(400).json({ message: error.message });
    }
  }));
}
