import { MAX_RECORDING_BYTES } from './camera-recordings.js';
import { recordAudit } from '../foundation/audit-helper.js';

export function registerCameraRecordingRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store, canAccessGeography }) {
  app.post('/api/camera/recordings', auth, rateLimit, asyncRoute(async (req, res) => {
    const dataUrl = String(req.body.dataUrl || '');
    if (!dataUrl.startsWith('data:')) return res.status(400).json({ message: 'A recorded video is required.' });
    const segmentId = String(req.body.segmentId || '').slice(0, 200);
    if (segmentId) {
      const existing = (await store.cameraRecordings()).find(record => record.submittedBy === req.user.id && record.segmentId === segmentId);
      if (existing) return res.json(existing);
    }
    const suppliedGeography = req.body.geography;
    if (suppliedGeography && !canAccessGeography(req.user, suppliedGeography))
      return res.status(403).json({ message: 'Recording location is outside your assigned scope.' });
    let refs;
    try {
      refs = await store.protectMediaPayload(
        [{ type: 'video', data: dataUrl }],
        { actorId: req.user.id, allowedUserIds: [req.user.id], source: 'camera-share-auto-save', retentionDays: 365, custodyEvent: 'auto-saved-on-stream-end', maxBytes: MAX_RECORDING_BYTES },
      );
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    const source = suppliedGeography || req.user;
    const geography = Object.fromEntries(['state', 'lga', 'ward', 'pollingUnit', 'station'].map(field => [field, String(source[field] || (field === 'state' ? 'Oyo' : '')).slice(0, 200)]));
    const point = req.body.location || {};
    const location = point.lat != null && point.lng != null && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)) && Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180
      ? { lat: Number(point.lat), lng: Number(point.lng), accuracy: Math.max(0, Number(point.accuracy) || 0) } : {};
    const record = await store.saveCameraRecording({
      actor: req.user,
      evidenceRef: refs[0],
      startedAt: req.body.startedAt || null,
      endedAt: req.body.endedAt || new Date().toISOString(),
      segmentId,
      location,
      geography,
    });
    await recordAudit(store, req, { action: 'camera_recording.auto_saved', entityType: 'evidence', entityId: refs[0].id, geography, details: { byteLength: refs[0].byteLength, mimeType: refs[0].mimeType } });
    res.status(201).json(record);
  }));

  app.get('/api/camera/recordings', auth, adminOnly, rateLimit, asyncRoute(async (req, res) => {
    const geography = { lga: req.query.lga || '', ward: req.query.ward || '', pollingUnit: req.query.pollingUnit || '' };
    if (!canAccessGeography(req.user, geography)) return res.status(403).json({ message: 'You are not authorized for this geographic scope.' });
    res.json(await store.cameraRecordings(req.query));
  }));
}
