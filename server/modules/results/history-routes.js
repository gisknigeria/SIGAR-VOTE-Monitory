import { normalizeLgaHistory, normalizeStateHistory, normalizeWardHistory, slugifyHistoricalArea } from "../../historical-results.js";
export function registerHistoryRoutes({ app, auth, rateLimit, asyncRoute }) {
  const HISTORICAL_RESULTS_ORIGIN = "https://api.nigeria2.com";
  const historicalResultCache = new Map();
  const fetchHistoricalResult = async (path) => {
    const cached = historicalResultCache.get(path);
    if (cached?.expiresAt > Date.now()) return cached.data;
    const response = await fetch(`${HISTORICAL_RESULTS_ORIGIN}${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Election-Monitor/1.0 historical results",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok)
      throw new Error(`Historical result provider returned ${response.status}`);
    const data = await response.json();
    historicalResultCache.set(path, {
      data,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    });
    return data;
  };
  const getOyo2023History = async (office) => {
    const payload = await fetchHistoricalResult("/api/v1/results/2023/nga_31");
    return normalizeStateHistory(payload, office);
  };
  const historicalProviderError = (res, error) => {
    console.error("[history] Historical result fetch failed:", error.message);
    return res
      .status(503)
      .json({
        message:
          "Previous-election geographic results are temporarily unavailable.",
      });
  };
  app.get(
    "/api/history/oyo/:year/:office",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const year = Number(req.params.year);
      const office = String(req.params.office || "").toLowerCase();
      if (year !== 2023 || !["presidential", "governor"].includes(office)) {
        return res
          .status(404)
          .json({
            message:
              "Geographic history is currently available for Oyo 2023 Presidential and Governorship results.",
          });
      }
      try {
        const data = await getOyo2023History(office);
        if (!data)
          return res
            .status(404)
            .json({
              message: "No geographic result was found for this election.",
            });
        res.set(
          "Cache-Control",
          "private, max-age=3600, stale-while-revalidate=43200",
        );
        return res.json({
          ...data,
          source: {
            name: "Nigeria 2.0 election evidence archive",
            url: "https://nigeria2.com/api/",
          },
          notice:
            "Geographic figures are transcribed election evidence for comparison and may not reconcile with INEC declared totals.",
          availableLevels:
            office === "presidential" ? ["lga", "ward", "polling-unit"] : ["lga"],
        });
      } catch (error) {
        return historicalProviderError(res, error);
      }
    }),
  );
  app.get(
    "/api/history/oyo/2023/presidential/lga/:lgaId",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      if (!/^\d{1,4}$/.test(req.params.lgaId))
        return res.status(400).json({ message: "Invalid LGA identifier." });
      try {
        const state = await getOyo2023History("presidential");
        const lga = state?.areas.find((item) => item.id === req.params.lgaId);
        if (!lga)
          return res.status(404).json({ message: "LGA history was not found." });
        const payload = await fetchHistoricalResult(
          `/elections/2023/oyo/${lga.id}-${slugifyHistoricalArea(lga.name)}`,
        );
        return res.json({
          ...normalizeLgaHistory(payload),
          notice:
            "Ward figures are evidence transcriptions, not a replacement for INEC declared totals.",
        });
      } catch (error) {
        return historicalProviderError(res, error);
      }
    }),
  );
  app.get(
    "/api/history/oyo/2023/presidential/lga/:lgaId/ward/:wardCode",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      if (
        !/^\d{1,4}$/.test(req.params.lgaId) ||
        !/^\d{2}-\d{2}-\d{2}$/.test(req.params.wardCode)
      )
        return res
          .status(400)
          .json({ message: "Invalid historical area identifier." });
      try {
        const state = await getOyo2023History("presidential");
        const lga = state?.areas.find((item) => item.id === req.params.lgaId);
        if (!lga)
          return res.status(404).json({ message: "LGA history was not found." });
        const payload = await fetchHistoricalResult(
          `/elections/2023/oyo/${lga.id}-${slugifyHistoricalArea(lga.name)}/${req.params.wardCode}`,
        );
        return res.json({
          ...normalizeWardHistory(payload),
          notice:
            "Polling-unit figures are evidence transcriptions; blank scores remain unavailable, not zero.",
        });
      } catch (error) {
        return historicalProviderError(res, error);
      }
    }),
  );

}
