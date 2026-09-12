# Offline field synchronization contract

The backend accepts replay-safe submissions, but this does not make the client offline-first by itself. The client must provide the durable queue, retry scheduler, attachment persistence, and user-facing conflict resolution.

## Submission envelope

Offline-capable incident, observation, result, and task-acknowledgement requests should include:

```json
{
  "submissionId": "device-generated-stable-id",
  "captureTime": "2026-09-11T10:15:00.000Z",
  "recordVersion": "1",
  "payloadHash": "sha256-of-canonical-payload",
  "attachmentIds": ["local-attachment-id"]
}
```

The backend adds `serverReceiptTime` on receipt. `submissionId` must remain stable across retries. A successful replay returns the original record. A different payload under the same identifier returns HTTP `409` with `code: SYNC_CONFLICT`, current version metadata, and the existing record ID.

## Queue and retry requirements

- Store queue entries in durable IndexedDB or equivalent storage.
- Keep the complete canonical payload, submission ID, capture time, payload hash, record version, and attachment references.
- Retry only transport failures, `408`, `425`, `429`, and `5xx` responses with exponential backoff and jitter.
- Do not retry validation errors or authorization failures without user action.
- Treat `409 SYNC_CONFLICT` as a review state. Fetch the current record and require an explicit merge or discard decision.
- Mark an item complete only after the server response is durably stored locally.
- Preserve the original capture time; never replace it with retry time.

## Attachments and video

Attachments should upload separately before or alongside the record, using stable attachment IDs and resumable chunks. The client must retain chunk progress and retry from the last confirmed offset. A failed upload must not cause the parent record to be silently discarded.

Offline video must not be posted through the election API. Use the dedicated media service recording/upload contract with a stable recording ID, resumable upload state, and explicit `recording-in-progress`, `finalized`, `failed`, `quarantined`, or `deleted` status. The parent incident/result should reference the recording ID and only be finalized when the media service has acknowledged the required recording state.

The media service exposes resumable recording operations:

- `POST /v1/recordings` creates a stable recording ID.
- `POST /v1/recordings/:id/chunks` accepts a base64 chunk with an `offset`; the response returns the next confirmed offset.
- `POST /v1/recordings/:id/finalize` finalizes the uploaded recording and can include its SHA-256 hash.
- `POST /v1/recordings/:id/stop` transitions an active stream to processing.

An offset mismatch returns `409 UPLOAD_OFFSET_CONFLICT` with the server's expected offset. The client must resume from that offset rather than re-uploading blindly. The media service owns video bytes and upload state; the election API stores only the recording ID and related evidence/reference metadata.

The client must handle token expiry, interrupted uploads, server restart, duplicate callbacks, and media-service unavailability explicitly.

## Current backend scope

Implemented backend support includes stable result and incident submission identifiers, capture/server timestamps, record versions, payload conflict responses, observation metadata, and task acknowledgement envelopes. Client queue persistence and complete offline-first behavior remain client work and must be validated separately.
