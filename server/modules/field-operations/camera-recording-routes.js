import { MAX_RECORDING_BYTES } from './camera-recordings.js';
import { recordAudit } from '../foundation/audit-helper.js';

export function registerCameraRecordingRoutes({ app, auth, adminOnly, rateLimit, asyncRoute, store, canAccessGeography }) {
  app.post('/api/camera/recordings', auth, rateLimit, asyncRoute(async (req, res) => {
    const dataUrl = String(req.body.dataUrl || '');
    if (!dataUrl.startsWith('data:')) return res.status(400).json({ message: 'A recorded video is required.' });
    let refs;
    try {
      refs = await store.protectMediaPayload(
        [{ type: 'video', data: dataUrl }],
        { actorId: req.user.id, allowedUserIds: [req.user.id], source: 'camera-share-auto-save', retentionDays: 365, custodyEvent: 'auto-saved-on-stream-end', maxBytes: MAX_RECORDING_BYTES },
      );
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    const geography = { state: 'Oyo', lga: req.user.lga || '', ward: req.user.ward || '', pollingUnit: req.user.pollingUnit || '', station: req.user.station || '' };
    const record = await store.saveCameraRecording({
      actor: req.user,
      evidenceRef: refs[0],
      startedAt: req.body.startedAt || null,
      endedAt: new Date().toISOString(),
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
