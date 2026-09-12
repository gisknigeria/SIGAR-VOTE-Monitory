# Dedicated Media Service

The election API remains the system of record for users, assignments, camera metadata, geographic authorization, and evidence references. The separate `media-server` owns live-media signaling, media sessions, recording state, and media-object delivery metadata. Video bytes, WebRTC SDP/ICE signaling, recording uploads, and transcoding must not pass through the election API.

## Services

Start the media service independently:

```text
MEDIA_SERVICE_SHARED_SECRET=<same secret as the API>
MEDIA_API_CALLBACK_URL=https://api.example/api/media/callback
MEDIA_STATE_FILE=/var/lib/sigar-media/media-state.json
MEDIA_PORT=8787
node media-server/index.js
```

The API requires `MEDIA_SERVICE_SHARED_SECRET` (or the existing `JWT_SECRET` as a development fallback) and advertises `MEDIA_SERVICE_URL` in `POST /api/media/token` responses. The scanner and media service should use separate private object storage from the election API.

## Authenticated APIs

- `POST /api/media/token` on the election API: authenticated users request a short-lived `publish` or `view` token for an authorized camera. Tokens expire after 120 seconds and contain camera, mode, geography, user, and scope claims.
- `POST /v1/sessions/revoke` on the media service: revokes a media token by `jti`.
- `POST /v1/recordings` and `POST /v1/recordings/:id/stop` on the media service: start and stop recording lifecycle state using a scoped publish token.
- `POST /api/media/callback` on the election API: accepts only HMAC-signed media lifecycle callbacks.

The media service persists session and recording state in `MEDIA_STATE_FILE`, so restart does not discard recording lifecycle metadata or active revocation state retained in the file.

## Client migration

The current dashboard uses the election API Socket.IO connection for `camera:view:request`, `camera:signal`, and peer WebRTC negotiation. That legacy path is disabled by default. The dashboard must be changed to:

1. Request `/api/media/token` with `mode=publish` or `mode=view`.
2. Connect a separate Socket.IO client to `MEDIA_SERVICE_URL` using that token.
3. Replace `camera:signal` with `media:signal` and use the media service session events.
4. Send recording lifecycle calls to the media service, never to the election API.
5. Refresh tokens before expiry and stop the media session when the API reports assignment removal, account deactivation, or session revocation.

Set `ENABLE_LEGACY_CAMERA_SIGNALING=true` only during a controlled migration window. It is not suitable for the separated production topology because it permits the election API to relay WebRTC signaling.