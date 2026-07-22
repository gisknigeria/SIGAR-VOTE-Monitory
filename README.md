# Election Monitoring Command Center

Election incident monitoring, live mapping and field coordination dashboard.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173` and sign in with `admin@command.local` / `admin123`.

## Demo capabilities

- Secure admin login with short-lived JWT
- Full Oyo State map view, address search, coordinates, and three map layers
- Create incidents from the map, assign field personnel, and update status
- Persistent incident data and live Socket.IO incident updates
- Field-unit map markers and Oyo-wide fit control

This is a demonstration build. Before operational deployment, replace JSON storage with PostgreSQL, configure strong secrets and refresh-token rotation, add audit logging/role guards, deploy behind HTTPS, and complete a security review.
# Election Monitoring Command Center
