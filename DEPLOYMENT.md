# Live deployment

## Render deployment (recommended for this repository)

1. Commit and push the included `render.yaml` and `Dockerfile` to the repository.
2. In Render, select **New > Blueprint** and connect the repository.
3. Render reads `render.yaml`, creates a Starter Docker web service, generates `JWT_SECRET`, and asks for the private values marked `sync: false`.
4. Enter the following private values when Render prompts you:

   - `DATABASE_URL`: your Neon pooled PostgreSQL connection string, including `sslmode=require`.
   - `ADMIN_PASSWORD`: the password for `admin@command.local`.
   - `SUPER_ADMIN_PASSWORD`: the password for `superadmin@command.local`.
   - `METERED_DOMAIN`: the Metered application domain, for example `your-app.metered.live` (no path).
   - `METERED_TURN_API_KEY`: the credential-scoped API key shown for the TURN credential in Metered. Do not use the account Secret Key.
   - `METERED_TURN_REGION`: optional Metered region; use `standard` to follow the credential's default region.

   Do not put these values directly into `render.yaml` or commit them to Git.

5. Apply the Blueprint and wait for the health check to pass.
6. Open the generated `onrender.com` URL and confirm `/api/health` returns an OK response. Its `database` field should say `neon-postgres`.

The Starter plan is intentional: Render's free web service cannot attach a persistent disk. Without a disk, personnel accounts and incidents stored in the current JSON file can be lost on restarts and deploys.

The single service supports WebSockets, so live incident and GPS updates use the same public HTTPS domain.

## Metered TURN

The browser requests authenticated ICE configuration from `/api/turn/credentials`. The server reads the Metered values from Render, retrieves the STUN/TURN URLs and credentials, validates them, and passes them to WebRTC without exposing the Render environment values.

In the Camera Feeds header:

- `Metered TURN ready` means valid Metered relay credentials were loaded.
- `Connected via Metered TURN` means the selected WebRTC candidate pair is actively using the relay.
- `Metered ready · direct route` means TURN is available, but WebRTC selected a faster direct/STUN route.
- `STUN fallback only` means the Metered values are missing, invalid, or the credential request failed.

After changing Render environment values, redeploy or restart the service so the server reads them.

## Neon database

If `DATABASE_URL` is set, the server stores users, incidents and camera streams in Neon/PostgreSQL instead of the local JSON file. The Blueprint now requests this as a private value. You can also add it directly in Render under **Environment**:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
```

Keep the real value only in Render/Neon secrets. Do not commit it into GitHub.

## Required before operational use

- Replace JSON storage with PostgreSQL and database migrations.
- Add refresh-token rotation, password reset and account lockout.
- Enforce role permissions on every API endpoint.
- Store login, assignment, GPS-access and deletion audit logs.
- Encrypt backups and sensitive data, and define GPS retention rules.
- Restrict CORS, add rate limiting and security headers.
- Use strong secrets held only in the hosting platform.
- Complete an independent security review and obtain organizational approval.

Phone GPS and native image sharing require the deployed HTTPS address. They will not work for other devices through `127.0.0.1`.
