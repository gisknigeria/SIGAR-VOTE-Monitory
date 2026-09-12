import { FALLBACK_ICE_SERVERS, sanitizeCloudflareIceServers } from '../turn.js';
export function registerTurnRoutes({ app, auth, rateLimit, asyncRoute, hasExpressTurn, hasCloudflareTurn, expressTurnServers, cloudflareTurnKeyId, cloudflareTurnApiToken, cloudflareTurnTtl }) {
  let turnCredentialCache = null;
  app.get(
    "/api/turn/credentials",
    auth,
    rateLimit,
    asyncRoute(async (_req, res) => {
      const expressFallbackServers = hasExpressTurn
        ? [...FALLBACK_ICE_SERVERS, ...expressTurnServers]
        : FALLBACK_ICE_SERVERS;
      if (!hasCloudflareTurn) {
        res.set("Cache-Control", "private, no-store");
        return res.json({
          iceServers: expressFallbackServers,
          provider: hasExpressTurn ? "expressturn" : "stun-fallback",
          fallbackProvider: hasExpressTurn ? "stun" : "",
        });
      }
      res.set("Cache-Control", "private, max-age=240");
      res.set("Vary", "Authorization");
      if (turnCredentialCache?.expiresAt > Date.now())
        return res.json(turnCredentialCache.data);
      try {
        const response = await fetch(
          `https://rtc.live.cloudflare.com/v1/turn/keys/${cloudflareTurnKeyId}/credentials/generate-ice-servers`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${cloudflareTurnApiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ttl: cloudflareTurnTtl }),
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (!response.ok)
          throw new Error(`Cloudflare returned ${response.status}`);
        const payload = await response.json();
        const cloudflareServers = sanitizeCloudflareIceServers(
          payload?.iceServers,
        );
        if (
          !cloudflareServers.some((server) => {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            return urls.some((url) => /^turns?:/i.test(url));
          })
        )
          throw new Error("Cloudflare returned no usable TURN servers");
        const data = {
          iceServers: [
            ...cloudflareServers,
            ...(hasExpressTurn ? expressTurnServers : []),
          ],
          provider: "cloudflare",
          fallbackProvider: hasExpressTurn ? "expressturn" : "stun-fallback",
          expiresAt: new Date(
            Date.now() + cloudflareTurnTtl * 1000,
          ).toISOString(),
        };
        turnCredentialCache = {
          data,
          expiresAt:
            Date.now() + Math.min(60 * 60 * 1000, cloudflareTurnTtl * 500),
        };
        return res.json(data);
      } catch (error) {
        console.error(
          "[turn] Cloudflare credential fetch failed:",
          error.message,
        );
        res.set("Cache-Control", "private, no-store");
        console.warn(
          `[turn] Cloudflare failed; ${hasExpressTurn ? "using ExpressTURN fallback" : "using STUN fallback"}`,
        );
        return res.json({
          iceServers: expressFallbackServers,
          provider: hasExpressTurn ? "expressturn" : "stun-fallback",
          fallbackProvider: hasExpressTurn ? "stun" : "",
        });
      }
    }),
  );

}
