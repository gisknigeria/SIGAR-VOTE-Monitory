# Election Monitoring Command Center

Election incident monitoring, live mapping and field coordination dashboard.

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
