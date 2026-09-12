import sharp from "sharp";
import { sanitizeString } from "../security.js";
import { OSUN_2026_PUBLISHED_RESULTS } from "../osun2026Results.js";
import { annotateGeneration } from "../modules/foundation/generation-provenance.js";
import { requestWithRetry } from "./retry.js";
export function registerIrevIntegration({ app, auth, adminOnly, rateLimit, irevOcrRateLimit, asyncRoute, store, isAdminRole, geminiApiKeys, geminiVisionModel, callGeminiVision, bundledOsunIrevArchive, fetchImpl = fetch }) {
  const IREV_API_ORIGIN = "https://dolphin-app-sleqh.ondigitalocean.app";
  const configuredOyoIrevId = sanitizeString(
    process.env.IREV_OYO_ELECTION_ID || "",
  ).toLowerCase();
  const IREV_OYO_ELECTION_ID = /^[a-f0-9]{24}$/.test(configuredOyoIrevId)
    ? configuredOyoIrevId
    : "";
  const IREV_OYO_PORTAL_URL = IREV_OYO_ELECTION_ID
    ? `https://irev.inecnigeria.org/elections/${IREV_OYO_ELECTION_ID}`
    : "https://irev.inecnigeria.org/";
  const IREV_IMAGE_HOSTS = new Set([
    "inc-s3-cache.incportals.com",
    "etransmission-result-docs.s3.eu-west-2.amazonaws.com",
  ]);
  let irevOyoCache = null;
  const irevOcrCache = new Map();
  const IREV_OYO_ARCHIVE_KEY = "irev_oyo_2027_governorship_archive_v1";
  const IREV_OYO_OCR_KEY = "irev_oyo_2027_governorship_ocr_v1";
  const isGovernorshipElectionName = (value) =>
    /(govern|gubern)/i.test(String(value || ""));
  let irevArchiveLoadPromise = null;
  const ensureIrevArchiveLoaded = () => {
    if (!irevArchiveLoadPromise)
      irevArchiveLoadPromise = Promise.all([
        store.setting(IREV_OYO_ARCHIVE_KEY, null),
        store.setting(IREV_OYO_OCR_KEY, {}),
      ]).then(async ([archive, extractions]) => {
        if (
          IREV_OYO_ELECTION_ID &&
          archive?.electionId === IREV_OYO_ELECTION_ID &&
          isGovernorshipElectionName(archive.electionName) &&
          Array.isArray(archive.uploads)
        ) {
          irevOyoCache = { data: { ...archive, offline: true }, expiresAt: 0 };
        }
        const savedExtractions = Object.entries(extractions || {});
        const supportedExtractions = savedExtractions.filter(
          ([, extraction]) =>
            String(extraction?.provider || "")
              .trim()
              .toLowerCase() === "gemini" && Array.isArray(extraction?.results),
        );
        for (const [id, extraction] of supportedExtractions) {
          if (id) irevOcrCache.set(id, extraction);
        }
        if (supportedExtractions.length !== savedExtractions.length) {
          await store.setSetting(
            IREV_OYO_OCR_KEY,
            Object.fromEntries(supportedExtractions),
          );
        }
      });
    return irevArchiveLoadPromise;
  };
  const isTrustedIrevImage = (value) => {
    try {
      const url = new URL(String(value || ""));
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        IREV_IMAGE_HOSTS.has(url.hostname)
      );
    } catch {
      return false;
    }
  };
  // Retries only bounded, transient failures (timeouts, rate limits, 5xx); a
  // malformed/oversized/unsuccessful payload is quarantined immediately (not
  // retried) since retrying would not fix a structurally invalid response.
  const fetchIrevJson = (path, maxBytes = 8 * 1024 * 1024) => requestWithRetry(async () => {
    const response = await fetchImpl(`${IREV_API_ORIGIN}/api/v1/${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Election-Monitor/1.0 IReV public-feed pilot",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const error = new Error(`IReV returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxBytes) throw new Error("IReV response is too large");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error("IReV response is too large");
    let payload;
    try {
      payload = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new Error("IReV returned malformed JSON");
    }
    if (!payload?.success) throw new Error("IReV returned an invalid response");
    return payload.data;
  }, { attempts: 3 });
  const normalizeIrevUpload = (item) => {
    const pollingUnit = item?.polling_unit || {};
    const imageUrl = item?.document?.url || "";
    return {
      id: sanitizeString(item?._id || ""),
      puCode: sanitizeString(item?.pu_code || pollingUnit.pu_code || ""),
      pollingUnit: sanitizeString(item?.name || pollingUnit.name || ""),
      lga: sanitizeString(pollingUnit?.lga?.name || ""),
      ward: sanitizeString(pollingUnit?.ward?.name || ""),
      uploadedAt: item?.document?.updated_at || item?.updated_at || "",
      imageUrl: isTrustedIrevImage(imageUrl) ? imageUrl : "",
      sourceUrl: IREV_OYO_PORTAL_URL,
      verificationStatus: "Awaiting verification",
    };
  };
  const oyoIrevWaitingData = () => ({
    configured: false,
    pilot: false,
    state: "Oyo",
    electionId: "",
    electionName: "Oyo 2027 Governorship Election",
    portalUrl: IREV_OYO_PORTAL_URL,
    submitted: 0,
    expected: 0,
    latestUploadAt: "",
    uploads: [],
    fetchedAt: new Date().toISOString(),
    archivedAt: "",
    offline: false,
    refreshIntervalMs: 900_000,
    notice: "Oyo 2027 governorship result sheets are not available on IReV yet.",
  });
  const loadOyoIrev = async (force = false) => {
    await ensureIrevArchiveLoaded();
    if (!IREV_OYO_ELECTION_ID) return oyoIrevWaitingData();
    if (!force && irevOyoCache?.expiresAt > Date.now()) return irevOyoCache.data;
    try {
      const [stats, allUnits] = await Promise.all([
        fetchIrevJson(`elections/${IREV_OYO_ELECTION_ID}/result/stats`),
        fetchIrevJson(`elections/${IREV_OYO_ELECTION_ID}/pus`, 16 * 1024 * 1024),
      ]);
      const remoteElectionName = sanitizeString(
        allUnits?.[0]?.election?.full_name || "",
      );
      if (
        Array.isArray(allUnits) &&
        allUnits.length &&
        (!isGovernorshipElectionName(remoteElectionName) || !/\boyo\b/i.test(remoteElectionName))
      ) {
        throw new Error(
          "The configured IReV election is not an Oyo governorship election",
        );
      }
      const liveUploads = (Array.isArray(allUnits) ? allUnits : [])
        .map(normalizeIrevUpload)
        .filter((item) => item.id && item.puCode && item.imageUrl);
      const mergedUploads = new Map(
        (irevOyoCache?.data?.uploads || []).map((upload) => [upload.id, upload]),
      );
      liveUploads.forEach((upload) => mergedUploads.set(upload.id, upload));
      const uploads = [...mergedUploads.values()]
        .sort((a, b) =>
          `${a.lga}|${a.ward}|${a.puCode}`.localeCompare(
            `${b.lga}|${b.ward}|${b.puCode}`,
          ),
        );
      const data = {
        pilot: true,
        configured: true,
        state: "Oyo",
        electionId: IREV_OYO_ELECTION_ID,
        electionName:
          remoteElectionName ||
          irevOyoCache?.data?.electionName ||
          "Oyo 2027 Governorship Election",
        portalUrl: IREV_OYO_PORTAL_URL,
        submitted: Math.max(uploads.length, Number(stats?.documents) || 0),
        expected: Math.max(
          0,
          Number(stats?.expected ?? stats?.pus) ||
            irevOyoCache?.data?.expected ||
            0,
        ),
        latestUploadAt:
          stats?.latest?.document?.updated_at ||
          stats?.latest?.updated_at ||
          liveUploads[0]?.uploadedAt ||
          irevOyoCache?.data?.latestUploadAt ||
          "",
        uploads,
        fetchedAt: new Date().toISOString(),
        archivedAt: new Date().toISOString(),
        offline: false,
        refreshIntervalMs: 60_000,
        notice: "",
      };
      const previous = irevOyoCache?.data;
      const changed =
        !previous ||
        previous.uploads?.length !== data.uploads.length ||
        previous.latestUploadAt !== data.latestUploadAt ||
        previous.submitted !== data.submitted;
      irevOyoCache = { data, expiresAt: Date.now() + 55_000 };
      if (changed) await store.setSetting(IREV_OYO_ARCHIVE_KEY, data);
      return data;
    } catch (error) {
      if (irevOyoCache?.data?.uploads?.length) {
        console.warn(
          "[irev] Live source unavailable; serving persistent archive:",
          error.message,
        );
        return {
          ...irevOyoCache.data,
          offline: true,
          refreshIntervalMs: 300_000,
          notice:
            "Live IReV is unavailable. Showing the last Oyo results saved on this server.",
        };
      }
      throw error;
    }
  };
  app.get(
    "/api/irev/oyo",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      try {
        const data = await loadOyoIrev(
          req.query.refresh === "1" && isAdminRole(req.user),
        );
        res.set("Cache-Control", "private, no-store");
        return res.json({
          ...data,
          uploads: data.uploads.map((upload) => ({
            ...upload,
            extraction: irevOcrCache.get(upload.id) || null,
          })),
        });
      } catch (error) {
        console.error("[irev] Oyo feed fetch failed:", error.message);
        return res
          .status(503)
          .json({
            message:
              "The official Oyo governorship IReV feed is temporarily unavailable.",
          });
      }
    }),
  );
  let irevOcrPersistQueue = Promise.resolve();
  let irevImageOptimizationQueue = Promise.resolve();
  const optimizeIrevImage = (imageBytes) => {
    const job = irevImageOptimizationQueue.then(() =>
      sharp(imageBytes, {
        sequentialRead: true,
        limitInputPixels: 25_000_000,
      })
        .rotate()
        .trim({ background: "#ffffff", threshold: 8 })
        .resize({
          width: 1600,
          withoutEnlargement: true,
          fit: "inside",
          fastShrinkOnLoad: true,
        })
        .grayscale()
        .normalize()
        .sharpen()
        .jpeg({ quality: 80, chromaSubsampling: "4:4:4" })
        .toBuffer(),
    );
    irevImageOptimizationQueue = job.catch(() => {});
    return job;
  };
  app.post(
    "/api/irev/oyo/ocr",
    auth,
    adminOnly,
    irevOcrRateLimit,
    asyncRoute(async (req, res) => {
      const uploadId = sanitizeString(req.body?.uploadId || "");
      const pilot = await loadOyoIrev();
      const upload = pilot.uploads.find((item) => item.id === uploadId);
      if (!upload)
        return res
          .status(404)
          .json({
            message: "IReV upload not found in the recent official feed.",
          });
      if (irevOcrCache.has(uploadId)) return res.json(irevOcrCache.get(uploadId));
      const imageResponse = await fetch(upload.imageUrl, {
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "Election-Monitor/1.0 IReV OCR archive" },
      });
      if (imageResponse.status === 429)
        return res
          .status(429)
          .json({
            code: "IREV_IMAGE_RATE_LIMITED",
            message:
              "IReV is temporarily limiting image downloads. OCR will resume automatically.",
          });
      if (!imageResponse.ok)
        return res
          .status(502)
          .json({
            code: "OCR_IMAGE_UNAVAILABLE",
            message: "The official result image could not be retrieved.",
          });
      const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
      if (!imageBytes.length)
        return res
          .status(422)
          .json({
            code: "OCR_IMAGE_EMPTY",
            message: "The IReV result image is empty.",
          });
      if (imageBytes.length > 8 * 1024 * 1024)
        return res
          .status(413)
          .json({
            code: "OCR_IMAGE_TOO_LARGE",
            message: "The IReV result image is too large to extract.",
          });
      try {
        const metadata = await sharp(imageBytes).metadata();
        if (!metadata.format || !metadata.width || !metadata.height)
          throw new Error("Invalid image");
      } catch {
        return res
          .status(415)
          .json({
            code: "OCR_IMAGE_FORMAT",
            message: "This file is not a valid result-sheet image.",
          });
      }
      if (!geminiApiKeys.length)
        return res
          .status(503)
          .json({
            code: "AI_NOT_CONFIGURED",
            message:
              "Gemini is not configured. Polling-unit uploads remain available.",
          });
      let body;
      try {
        const optimizedImage = await optimizeIrevImage(imageBytes);
        body = await callGeminiVision({
          contents: [
            {
              parts: [
                {
                  text: "Read only the political-party vote table in this Nigerian INEC result sheet. Return every clearly readable party abbreviation and its vote count. Do not include totals, explanations, headings, or uncertain guesses.",
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: optimizedImage.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                results: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      party: { type: "STRING" },
                      votes: { type: "INTEGER" },
                    },
                    required: ["party", "votes"],
                  },
                },
              },
              required: ["results"],
            },
          },
        });
      } catch (error) {
        console.warn(
          "[irev] Gemini extraction unavailable:",
          error.status || "",
          error.message,
        );
        if (error.status === 429)
          return res
            .status(429)
            .json({
              code: "AI_QUOTA_EXHAUSTED",
              message:
                "Gemini extraction is paused because its quota is unavailable. Polling-unit uploads remain visible.",
            });
        return res
          .status(503)
          .json({
            code: "AI_SERVICE_UNAVAILABLE",
            message:
              "Gemini is temporarily unavailable. Polling-unit uploads remain visible.",
          });
      }
      let parsed = [];
      try {
        const responseText =
          body.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || "")
            .join("") || "";
        const decoded = JSON.parse(
          responseText.replace(/^```json\s*|\s*```$/gi, "").trim(),
        );
        parsed = Array.isArray(decoded) ? decoded : decoded?.results;
      } catch {
        parsed = [];
      }
      const results = (Array.isArray(parsed) ? parsed : [])
        .map((item) => ({
          party: sanitizeString(item?.party || "")
            .replace(/[^A-Za-z0-9&-]/g, "")
            .trim()
            .toUpperCase()
            .slice(0, 12),
          votes: Number(item?.votes),
        }))
        .filter(
          (item) =>
            item.party &&
            Number.isInteger(item.votes) &&
            item.votes >= 0 &&
            item.votes <= 5000,
        )
        .reduce(
          (unique, item) =>
            unique.some((existing) => existing.party === item.party)
              ? unique
              : [...unique, item],
          [],
        );
      if (!results.length)
        return res
          .status(502)
          .json({
            message:
              "No readable party vote counts were extracted from this image.",
          });
      const extraction = annotateGeneration({
        uploadId,
        results,
        sourceUrl: upload.imageUrl,
        extractedAt: new Date().toISOString(),
      }, { generationType: "generative-ai", provider: "gemini", model: geminiVisionModel, inputRefs: [upload.imageUrl], uncertainty: "unscored-per-field", reviewStatus: "unreviewed" });
      irevOcrCache.set(uploadId, extraction);
      const persistenceTask = irevOcrPersistQueue.then(() =>
        store.setSetting(IREV_OYO_OCR_KEY, Object.fromEntries(irevOcrCache)),
      );
      irevOcrPersistQueue = persistenceTask.catch((error) =>
        console.error("[irev] Could not persist OCR result:", error.message),
      );
      await persistenceTask;
      return res.json(extraction);
    }),
  );
  const IREV_OSUN_ELECTION_ID = "6a7f788adcbc755a763f082a";
  const IREV_OSUN_PORTAL_URL = `https://irev.inecnigeria.org/elections/${IREV_OSUN_ELECTION_ID}`;
  const IREV_OSUN_ARCHIVE_KEY = "irev_osun_archive_v1";
  const preparedOsunPilot = {
    pilot: true,
    configured: true,
    state: "Osun",
    electionId: IREV_OSUN_ELECTION_ID,
    electionName: OSUN_2026_PUBLISHED_RESULTS.election,
    portalUrl: IREV_OSUN_PORTAL_URL,
    submitted: OSUN_2026_PUBLISHED_RESULTS.count,
    expected: OSUN_2026_PUBLISHED_RESULTS.count,
    latestUploadAt: OSUN_2026_PUBLISHED_RESULTS.importedAt,
    uploads: OSUN_2026_PUBLISHED_RESULTS.pollingUnits.map((row) => ({
      id: row.id,
      puCode: row.puCode,
      pollingUnit: row.pollingUnit,
      lga: row.lga,
      ward: row.ward,
      uploadedAt: OSUN_2026_PUBLISHED_RESULTS.importedAt,
      imageUrl: "",
      sourceUrl: OSUN_2026_PUBLISHED_RESULTS.sourceUrl,
      verificationStatus: "Prepared archive",
    })),
    fetchedAt: OSUN_2026_PUBLISHED_RESULTS.importedAt,
    archivedAt: OSUN_2026_PUBLISHED_RESULTS.importedAt,
    offline: true,
    refreshIntervalMs: 0,
    notice:
      "Showing the prepared Osun results archive. Live IReV downloads are disabled for this demo.",
  };
  let irevOsunCache = null;
  let irevOsunArchiveLoadPromise = null;
  let irevOsunLiveLookupPromise = null;
  let irevOsunLiveLookupExpiresAt = 0;
  let irevOsunLiveLookupError = null;
  let irevOsunPollingStopped = false;
  let irevOsunPollingStopReason = "";
  const irevOsunLiveUploadsByCode = new Map();
  const irevOsunLiveUploadsById = new Map();
  const ensureOsunIrevArchiveLoaded = () => {
    if (!irevOsunArchiveLoadPromise)
      irevOsunArchiveLoadPromise = store
        .setting(IREV_OSUN_ARCHIVE_KEY, null)
        .then((archive) => {
          const savedArchive =
            archive?.electionId === IREV_OSUN_ELECTION_ID &&
            Array.isArray(archive.uploads)
              ? archive
              : null;
          const selectedArchive =
            savedArchive?.uploads?.length >=
            (bundledOsunIrevArchive?.uploads?.length || 0)
              ? savedArchive
              : bundledOsunIrevArchive;
          if (selectedArchive) {
            irevOsunCache = {
              data: { ...selectedArchive, offline: true },
              expiresAt: 0,
            };
          }
        });
    return irevOsunArchiveLoadPromise;
  };
  const normalizeOsunIrevUpload = (item) => {
    const pollingUnit = item?.polling_unit || {};
    const imageUrl = item?.document?.url || "";
    return {
      id: sanitizeString(item?._id || ""),
      puCode: sanitizeString(item?.pu_code || pollingUnit.pu_code || ""),
      pollingUnit: sanitizeString(item?.name || pollingUnit.name || ""),
      lga: sanitizeString(pollingUnit?.lga?.name || ""),
      ward: sanitizeString(pollingUnit?.ward?.name || ""),
      uploadedAt: item?.document?.updated_at || item?.updated_at || "",
      imageUrl: isTrustedIrevImage(imageUrl) ? imageUrl : "",
      sourceUrl: IREV_OSUN_PORTAL_URL,
      verificationStatus: "Awaiting verification",
    };
  };
  const loadOsunIrevImageLookup = async () => {
    if (
      irevOsunLiveUploadsByCode.size &&
      irevOsunLiveLookupExpiresAt > Date.now()
    )
      return;
    if (irevOsunLiveLookupError && irevOsunLiveLookupExpiresAt > Date.now())
      throw irevOsunLiveLookupError;
    if (!irevOsunLiveLookupPromise) {
      irevOsunLiveLookupPromise = fetchIrevJson(
        `elections/${IREV_OSUN_ELECTION_ID}/pus`,
        16 * 1024 * 1024,
      )
        .then((allUnits) => {
          const uploads = (Array.isArray(allUnits) ? allUnits : [])
            .map(normalizeOsunIrevUpload)
            .filter((item) => item.id && item.puCode && item.imageUrl);
          irevOsunLiveUploadsByCode.clear();
          irevOsunLiveUploadsById.clear();
          for (const upload of uploads) {
            irevOsunLiveUploadsByCode.set(upload.puCode, upload);
            irevOsunLiveUploadsById.set(upload.id, upload);
          }
          irevOsunLiveLookupError = null;
          irevOsunLiveLookupExpiresAt = Date.now() + 15 * 60_000;
        })
        .catch((error) => {
          irevOsunLiveLookupError = error;
          irevOsunLiveLookupExpiresAt = Date.now() + 60_000;
          throw error;
        })
        .finally(() => {
          irevOsunLiveLookupPromise = null;
        });
    }
    await irevOsunLiveLookupPromise;
  };
  const loadOsunIrevPilot = async (force = false) => {
    await ensureOsunIrevArchiveLoaded();
    if (irevOsunPollingStopped && !force) {
      const fallback = irevOsunCache?.data || preparedOsunPilot;
      return {
        ...fallback,
        offline: true,
        pollingStopped: true,
        refreshIntervalMs: 0,
        notice:
          "Live IReV polling is stopped because the source is unavailable. Use Refresh now to retry manually.",
      };
    }
    if (force) {
      irevOsunPollingStopped = false;
      irevOsunPollingStopReason = "";
    }
    if (!force && irevOsunCache?.expiresAt > Date.now())
      return irevOsunCache.data;
    try {
      const [stats, allUnits] = await Promise.all([
        fetchIrevJson(`elections/${IREV_OSUN_ELECTION_ID}/result/stats`),
        fetchIrevJson(`elections/${IREV_OSUN_ELECTION_ID}/pus`, 16 * 1024 * 1024),
      ]);
      const liveUploads = (Array.isArray(allUnits) ? allUnits : [])
        .map(normalizeOsunIrevUpload)
        .filter((item) => item.id && item.puCode && item.imageUrl);
      const mergedUploads = new Map(
        (irevOsunCache?.data?.uploads || []).map((upload) => [upload.id, upload]),
      );
      preparedOsunPilot.uploads.forEach((upload) =>
        mergedUploads.set(upload.id, upload),
      );
      liveUploads.forEach((upload) => mergedUploads.set(upload.id, upload));
      const uploads = [...mergedUploads.values()]
        .map((upload) =>
          upload.imageUrl
            ? upload
            : {
                ...upload,
                imageUrl:
                  liveUploads.find((item) => item.puCode === upload.puCode)
                    ?.imageUrl || "",
              },
        )
        .sort((a, b) =>
          `${a.lga}|${a.ward}|${a.puCode}`.localeCompare(
            `${b.lga}|${b.ward}|${b.puCode}`,
          ),
        );
      const data = {
        pilot: true,
        configured: true,
        state: "Osun",
        electionId: IREV_OSUN_ELECTION_ID,
        electionName: sanitizeString(
          allUnits?.[0]?.election?.full_name ||
            irevOsunCache?.data?.electionName ||
            "Osun governorship election",
        ),
        portalUrl: IREV_OSUN_PORTAL_URL,
        submitted: Math.max(uploads.length, Number(stats?.documents) || 0),
        expected: Math.max(
          0,
          Number(stats?.expected ?? stats?.pus) ||
            irevOsunCache?.data?.expected ||
            0,
        ),
        latestUploadAt:
          stats?.latest?.document?.updated_at ||
          stats?.latest?.updated_at ||
          liveUploads[0]?.uploadedAt ||
          irevOsunCache?.data?.latestUploadAt ||
          "",
        uploads,
        fetchedAt: new Date().toISOString(),
        archivedAt: new Date().toISOString(),
        offline: false,
        pollingStopped: false,
        refreshIntervalMs: 60_000,
        notice: "",
      };
      const previous = irevOsunCache?.data;
      const changed =
        !previous ||
        previous.uploads?.length !== data.uploads.length ||
        previous.latestUploadAt !== data.latestUploadAt ||
        previous.submitted !== data.submitted;
      irevOsunCache = { data, expiresAt: Date.now() + 55_000 };
      if (changed) await store.setSetting(IREV_OSUN_ARCHIVE_KEY, data);
      return data;
    } catch (error) {
      irevOsunPollingStopped = true;
      irevOsunPollingStopReason = error.message;
      if (!force && irevOsunCache?.data) {
        return {
          ...irevOsunCache.data,
          offline: true,
          pollingStopped: true,
          refreshIntervalMs: 0,
          notice:
            "Live IReV polling is stopped because the source is unavailable. Showing the saved archive; use Refresh now to retry manually.",
        };
      }
      if (irevOsunCache?.data?.uploads?.length) {
        console.warn(
          "[irev] Live source unavailable; serving persistent archive:",
          error.message,
        );
        return {
          ...irevOsunCache.data,
          offline: true,
          pollingStopped: true,
          refreshIntervalMs: 0,
          notice:
            "Live IReV polling is stopped because the source is unavailable. Use Refresh now to retry manually.",
        };
      }
      console.warn(
        "[irev] Live source unavailable; serving prepared Osun results:",
        error.message,
      );
      return {
        ...preparedOsunPilot,
        pollingStopped: true,
        refreshIntervalMs: 0,
        notice:
          "Live IReV polling is stopped because the source is unavailable. Showing the prepared archive; use Refresh now to retry manually.",
      };
    }
  };
  app.get(
    "/api/irev/osun",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      try {
        const data = await loadOsunIrevPilot(
          req.query.refresh === "1" && isAdminRole(req.user),
        );
        res.set("Cache-Control", "private, no-store");
        return res.json(data);
      } catch (error) {
        console.error("[irev] Osun pilot fetch failed:", error.message);
        return res
          .status(503)
          .json({
            message: "The official IReV feed is temporarily unavailable.",
          });
      }
    }),
  );
  app.get(
    "/api/irev/osun/uploads/:puCode",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const puCode = sanitizeString(req.params.puCode || "").trim();
      if (!puCode || puCode.length > 80)
        return res.status(400).json({ message: "Invalid polling-unit code." });
      try {
        await loadOsunIrevImageLookup();
        const upload = irevOsunLiveUploadsByCode.get(puCode);
        if (!upload)
          return res
            .status(404)
            .json({
              message:
                "No official result-sheet image is available for this polling unit.",
            });
        return res.json({
          ...upload,
          imageUrl: `/api/irev/osun/images/${encodeURIComponent(upload.id)}`,
        });
      } catch (error) {
        console.warn("[irev] Osun image lookup unavailable:", error.message);
        return res
          .status(503)
          .json({
            message:
              "The official result-sheet image service is temporarily unavailable. The saved result figures are still shown.",
          });
      }
    }),
  );
  app.get(
    "/api/irev/osun/images/:uploadId",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const uploadId = sanitizeString(req.params.uploadId || "").trim();
      if (!/^[a-f0-9]{24}$/i.test(uploadId))
        return res
          .status(400)
          .json({ message: "Invalid IReV upload identifier." });
      try {
        await loadOsunIrevImageLookup();
        const upload = irevOsunLiveUploadsById.get(uploadId);
        if (!upload?.imageUrl || !isTrustedIrevImage(upload.imageUrl))
          return res
            .status(404)
            .json({ message: "Result-sheet image not found." });
        const imageResponse = await fetch(upload.imageUrl, {
          headers: {
            Accept: "image/*",
            "User-Agent": "Election-Monitor/1.0 IReV image proxy",
          },
          signal: AbortSignal.timeout(20_000),
        });
        if (!imageResponse.ok)
          return res
            .status(502)
            .json({
              message: "The official result-sheet image could not be retrieved.",
            });
        const contentType = String(
          imageResponse.headers.get("content-type") || "",
        )
          .split(";")[0]
          .trim()
          .toLowerCase();
        const contentLength = Number(
          imageResponse.headers.get("content-length") || 0,
        );
        if (!contentType.startsWith("image/"))
          return res
            .status(415)
            .json({ message: "The official result-sheet file is not an image." });
        if (contentLength > 8 * 1024 * 1024)
          return res
            .status(413)
            .json({
              message: "The official result-sheet image is too large to display.",
            });
        const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
        if (!imageBytes.length || imageBytes.length > 8 * 1024 * 1024)
          return res
            .status(413)
            .json({
              message: "The official result-sheet image is empty or too large.",
            });
        res.set("Content-Type", contentType);
        res.set("Cache-Control", "private, max-age=3600");
        return res.send(imageBytes);
      } catch (error) {
        console.warn("[irev] Osun image proxy unavailable:", error.message);
        return res
          .status(503)
          .json({
            message:
              "The official result-sheet image is temporarily unavailable.",
          });
      }
    }),
  );
  app.get("/api/irev/osun/results", auth, rateLimit, (_req, res) => {
    res.set("Cache-Control", "private, max-age=3600");
    return res.json(OSUN_2026_PUBLISHED_RESULTS);
  });

  return { IREV_OYO_ELECTION_ID, loadOyoIrev, loadOsunIrevPilot };
}
