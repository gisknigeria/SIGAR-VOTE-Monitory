# Live deployment

## Vercel frontend with Render backend

This repository is configured so Vercel serves the compiled Vite frontend while Render continues to run Express, Socket.IO, PostgreSQL access, IReV endpoints and other server-only features.

1. Import this Git repository into Vercel.
2. Keep the detected framework as **Vite**. The included `vercel.json` runs `npm run build`, publishes `dist`, and sends SPA routes to `index.html`.
3. In **Vercel → Project Settings → Environment Variables**, add the following for Production and Preview:

   ```env
   VITE_API_URL=https://e-monitoring.onrender.com
   ```

   Replace that value if the Render service uses a different public URL. Redeploy Vercel after changing it because Vite embeds this value during the build.

4. After Vercel supplies the final frontend domain, update Render's `CORS_ORIGIN` to contain both exact origins, separated by a comma:

   ```env
   CORS_ORIGIN=https://e-monitoring.onrender.com,https://YOUR-PROJECT.vercel.app
   ```

5. Keep `IREV_AUTO_SYNC=false` on Render. If the live IReV source is unavailable, the API now serves the bundled archive, reports that polling has stopped, and waits for an administrator to press **Refresh now** before trying the source again.

Do not add database URLs, JWT secrets, passwords, TURN credentials or private API keys to Vercel. They belong only on Render.

## Render deployment (recommended for this repository)

1. Commit and push the included `render.yaml` and `Dockerfile` to the repository.
2. In Render, select **New > Blueprint** and connect the repository.
3. Render reads `render.yaml`, creates a Starter Docker web service, generates `JWT_SECRET`, and asks for the private values marked `sync: false`.
4. Enter the following private values when Render prompts you:

   - `DATABASE_URL`: your Neon pooled PostgreSQL connection string, including `sslmode=require`.
   - `ADMIN_PASSWORD`: the password for `admin@command.local`.
   - `SUPER_ADMIN_PASSWORD`: the password for `superadmin@command.local`.
   - `CLOUDFLARE_TURN_KEY_ID`: the 32-character TURN key ID created under Cloudflare Realtime TURN.
   - `CLOUDFLARE_TURN_API_TOKEN`: the secret bearer token belonging to that TURN key—not a general Cloudflare account API token.
   - `CLOUDFLARE_TURN_TTL`: credential lifetime in seconds. Keep the provided default of `86400` unless calls must last longer than one day.
   - `EXPRESSTURN_URLS`, `EXPRESSTURN_USERNAME`, and `EXPRESSTURN_PASSWORD`: the backup relay credentials supplied by ExpressTURN.

   Do not put these values directly into `render.yaml` or commit them to Git.

5. Apply the Blueprint and wait for the health check to pass.
6. Open the generated `onrender.com` URL and confirm `/api/health` returns an OK response. Its `database` field should say `neon-postgres`.

The Starter plan is intentional: Render's free web service cannot attach a persistent disk. Without a disk, personnel accounts and incidents stored in the current JSON file can be lost on restarts and deploys.

The single service supports WebSockets, so live incident and GPS updates use the same public HTTPS domain.

## Cloudflare TURN with ExpressTURN fallback

The browser requests authenticated ICE configuration from `/api/turn/credentials`. The server uses the private Cloudflare TURN key to generate short-lived ICE credentials. Cloudflare servers are returned first and ExpressTURN servers are appended second, allowing WebRTC to gather backup relay candidates during the same connection attempt. If Cloudflare credential generation fails, the endpoint returns ExpressTURN directly. The last fallback is public STUN only.

In the Camera Feeds header:

- `Cloudflare TURN ready · ExpressTURN backup` means both relay providers are configured.
- `Connected via Cloudflare TURN` means Cloudflare is carrying the selected relay connection.
- `Connected via ExpressTURN` means the backup relay was selected.
- `Cloudflare ready · direct route` means TURN is available, but WebRTC selected a faster direct/STUN route.
- `STUN fallback only` means neither TURN provider is available.

After changing Render environment values, redeploy or restart the service so the server reads them.

## ExpressTURN fallback

Cloudflare is primary. Copy the TURN URL(s), username, and password shown in the ExpressTURN dashboard into these private Render variables so ExpressTURN is available second:

```env
EXPRESSTURN_URLS=turn:YOUR_EXPRESSTURN_HOST:3478,turns:YOUR_EXPRESSTURN_HOST:5349
EXPRESSTURN_USERNAME=the-username-from-expressturn
EXPRESSTURN_PASSWORD=the-password-from-expressturn
```

Use the exact URLs and credentials supplied by ExpressTURN. Do not put dashboard credentials in frontend code or commit them. The server returns the credentials only to authenticated users through `/api/turn/credentials`. When ExpressTURN is active, the camera panel reports `ExpressTURN ready` or `Connected via ExpressTURN`.

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
