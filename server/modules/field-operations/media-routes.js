import { createMediaAuth } from './media-auth.js';

export function registerMediaRoutes({ app, auth, rateLimit, asyncRoute, store, canAccessGeography, secret }) {
  const mediaAuth = createMediaAuth({ secret: process.env.MEDIA_SERVICE_SHARED_SECRET || secret, store, canAccessGeography });
  app.post('/api/media/token', auth, rateLimit, asyncRoute(async (req, res) => {
    const camera = (await store.cameras()).find((item) => item.id === String(req.body.cameraId || '').trim());
    if (!camera) return res.status(404).json({ message: 'Camera not found.' });
    try {
      const token = mediaAuth.issueMediaToken({ user: req.user, cameraId: camera.id, mode: req.body.mode || 'view', geography: camera });
      res.json({ token, mediaServiceUrl: process.env.MEDIA_SERVICE_URL || '', expiresIn: 120, cameraId: camera.id, mode: req.body.mode || 'view' });
    } catch (error) { res.status(403).json({ message: error.message }); }
  }));
  app.post('/api/media/callback', asyncRoute(async (req, res) => {
    const signature = req.headers['x-media-signature'];
    const raw = JSON.stringify(req.body || {});
    if (!mediaAuth.verifyCallback(raw, signature)) return res.status(401).json({ message: 'Invalid media callback signature.' });
    res.status(204).end();
  }));
}