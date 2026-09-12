# Election Monitoring Command Center

Election incident monitoring, live mapping and field coordination dashboard.

## Oyo backend architecture

The backend is organized by persistent capabilities: identity, geography, field operations, incidents, results, communications, notifications and intelligence. Election phases are views across those capabilities. See [the CTO architecture review](docs/EIGARS-OYO-ARCHITECTURE.md) for domain ownership, the data model, P0/P1 sequencing and remaining implementation work, and [the requirement alignment checklist](docs/REQUIREMENT-ALIGNMENT-CHECKLIST.md) for which capabilities are verified by an automated test versus reviewed-but-unexercised.

```powershell
npm.cmd run test:backend
npm.cmd run test:smoke
npm.cmd run test:media-smoke
npm.cmd run benchmark:geography
npm.cmd run load:probe
npm.cmd run export:backend
```

`test:media-smoke` exercises the standalone media service's real recording lifecycle with locally-signed tokens. `benchmark:geography` and `load:probe` are directional, run-on-this-machine measurements against the JSON-store dev server, not production capacity tests -- see [`docs/BACKUP_AND_RECOVERY.md`](docs/BACKUP_AND_RECOVERY.md) for the (reviewed, not yet live-tested) backup/restore procedure.

The export command creates a new `outputs/oyo-backend` directory with backend code, required shared data, tests and a backend-only dependency manifest. It excludes secrets and local runtime data and refuses to overwrite an existing destination. Set `API_ONLY=true` for a separate backend deployment. The Osun pilot remains enabled as a separate reference (`ENABLE_OSUN_PILOT=true`); set it to false only when you want to disable it.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Configure the administrator credentials in `.env`; development generates temporary credentials when they are omitted.

## Demo capabilities

- Secure admin login with short-lived JWT
- Full Oyo State map view, address search, coordinates, and three map layers
- Create incidents from the map, assign field personnel, and update status
- Persistent incident data and live Socket.IO incident updates
- Field-unit map markers and Oyo-wide fit control
- Supervisor incident queues, assignment notifications, evidence chat, and multi-ward supervision
- Pre-election historical comparisons and post-election evidence/reconciliation analysis
- Configurable Oyo IReV result-sheet feed, persistent archive, OCR extraction, and field/IReV comparison
- Camera recording and sharing with polling-unit, ward, LGA, GPS, address, and timestamp watermarks
- Administrator account assignment, role/ward changes, and password resets

## Oyo IReV and OCR

Set `IREV_OYO_ELECTION_ID` when INEC publishes the Oyo election identifier. Until then, the IReV screen remains in a clearly labeled waiting state. Set `GEMINI_API_KEY` and optionally `GEMINI_VISION_MODEL` to enable automatic result-sheet extraction. Reverse location labels use the configured `REVERSE_GEOCODER_URL` and fall back safely to coordinates.

For operational deployment, use PostgreSQL, configure strong secrets, deploy behind HTTPS, and complete a security and data-protection review.
