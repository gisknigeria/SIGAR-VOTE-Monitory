import { formatReverseLocation } from "../location.js";
import { requestWithRetry } from "./retry.js";
export function createGeocodingClient({ fetchImpl = fetch } = {}) {
  const reverseLocationCache = new Map();
  let reverseLocationQueue = Promise.resolve();
  let nextReverseLocationRequestAt = 0;
  const reverseLocation = async (lat, lng) => {
    const cacheKey = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
    const cached = reverseLocationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const lookup = reverseLocationQueue.then(async () => {
      const waitMs = Math.max(0, nextReverseLocationRequestAt - Date.now());
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      nextReverseLocationRequestAt = Date.now() + 1_100;
      const baseUrl = String(
        process.env.REVERSE_GEOCODER_URL || "https://nominatim.openstreetmap.org",
      ).replace(/\/$/, "");
      const contactUrl =
        process.env.RENDER_EXTERNAL_URL || "https://sigar-vote.local";
      const body = await requestWithRetry(async () => {
        const response = await fetchImpl(
          `${baseUrl}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
          {
            headers: {
              Accept: "application/json",
              "Accept-Language": "en",
              "User-Agent": `Oyo-Election-Monitor/1.0 (+${contactUrl})`,
            },
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!response.ok) {
          const error = new Error(`Address lookup returned ${response.status}`);
          error.status = response.status;
          throw error;
        }
        return response.json();
      }, { attempts: 3 });
      const value = formatReverseLocation(body, lat, lng);
      reverseLocationCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + 7 * 24 * 60 * 60_000,
      });
      if (reverseLocationCache.size > 2_000)
        reverseLocationCache.delete(reverseLocationCache.keys().next().value);
      return value;
    });
    reverseLocationQueue = lookup.catch(() => {});
    return lookup;
  };

  return { reverseLocation };
}
