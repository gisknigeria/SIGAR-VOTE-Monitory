import { FALLBACK_ICE_SERVERS, sanitizeCloudflareIceServers } from '../turn.js';
export function registerTurnRoutes({ app, auth, rateLimit, asyncRoute, hasExpressTurn, hasCloudflareTurn, expressTurnServers, cloudflareTurnKeyId, cloudflareTurnApiToken, cloudflareTurnTtl }) {
  let turnCredentialCache = null;
  /**
   * The last *observed* outcome, not just what the env vars claim. Having
   * CLOUDFLARE_TURN_KEY_ID set says nothing about whether the token still works, so
   * health/readiness report this instead -- a revoked token must not keep showing
   * "cloudflare" while every real call quietly relays through STUN only.
   */
  let lastOutcome = {
    configured: hasCloudflareTurn ? 'cloudflare' : hasExpressTurn ? 'expressturn' : 'stun-fallback-only',
    active: hasCloudflareTurn ? 'unverified' : hasExpressTurn ? 'expressturn' : 'stun-fallback-only',
    verifiedAt: null,
    lastError: '',
  };

  const fallbackPayload = () => ({
    iceServers: hasExpressTurn ? [...FALLBACK_ICE_SERVERS, ...expressTurnServers] : FALLBACK_ICE_SERVERS,
    provider: hasExpressTurn ? 'expressturn' : 'stun-fallback',
    fallbackProvider: hasExpressTurn ? 'stun' : '',
  });

  const resolveIceConfiguration = async () => {
    if (!hasCloudflareTurn) return { payload: fallbackPayload(), cacheable: false };
    if (turnCredentialCache?.expiresAt > Date.now()) return { payload: turnCredentialCache.data, cacheable: true };
    try {
      const response = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${cloudflareTurnKeyId}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${cloudflareTurnApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: cloudflareTurnTtl }),
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) throw new Error(`Cloudflare returned ${response.status}`);
      const payload = await response.json();
      const cloudflareServers = sanitizeCloudflareIceServers(payload?.iceServers);
      if (
        !cloudflareServers.some((server) => {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          return urls.some((url) => /^turns?:/i.test(url));
        })
      )
        throw new Error('Cloudflare returned no usable TURN servers');
      const data = {
        iceServers: [...cloudflareServers, ...(hasExpressTurn ? expressTurnServers : [])],
        provider: 'cloudflare',
        fallbackProvider: hasExpressTurn ? 'expressturn' : 'stun-fallback',
        expiresAt: new Date(Date.now() + cloudflareTurnTtl * 1000).toISOString(),
      };
      turnCredentialCache = {
        data,
        expiresAt: Date.now() + Math.min(60 * 60 * 1000, cloudflareTurnTtl * 500),
      };
      lastOutcome = { ...lastOutcome, active: 'cloudflare', verifiedAt: new Date().toISOString(), lastError: '' };
      return { payload: data, cacheable: true };
    } catch (error) {
      console.error('[turn] Cloudflare credential fetch failed:', error.message);
      console.warn(
        `[turn] Cloudflare failed; ${hasExpressTurn ? 'using ExpressTURN fallback' : 'using STUN fallback'}`,
      );
      lastOutcome = {
        ...lastOutcome,
        active: hasExpressTurn ? 'expressturn' : 'stun-fallback-only',
        verifiedAt: new Date().toISOString(),
        lastError: error.message,
      };
      return { payload: fallbackPayload(), cacheable: false };
    }
  };

  app.get(
    '/api/turn/credentials',
    auth,
    rateLimit,
    asyncRoute(async (_req, res) => {
      const { payload, cacheable } = await resolveIceConfiguration();
      if (cacheable) {
        res.set('Cache-Control', 'private, max-age=240');
        res.set('Vary', 'Authorization');
      } else {
        res.set('Cache-Control', 'private, no-store');
      }
      return res.json(payload);
    }),
  );

  return {
    turnStatus: () => ({ ...lastOutcome }),
    /** Exercises the real credential path once (used at boot) so a bad token surfaces immediately. */
    verifyTurnProvider: async () => {
      await resolveIceConfiguration();
      return { ...lastOutcome };
    },
  };
}
