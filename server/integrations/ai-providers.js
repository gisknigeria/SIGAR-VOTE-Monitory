import { sanitizeString } from "../security.js";
export function createAiProviders({}) {
  const openAiPrimaryModel = process.env.OPENAI_MODEL || "gpt-5.6-terra";
  const openAiFallbackModel = process.env.OPENAI_FALLBACK_MODEL || "gpt-5.6-luna";
  const groqPrimaryModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const groqFallbackModel =
    process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
  const groqNewsModel = process.env.GROQ_NEWS_MODEL || "groq/compound-mini";
  const geminiVisionModel =
    process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash-lite";
  const geminiApiKeys = [
    ...new Set(
      [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
  const geminiKeyCooldowns = new Map();
  let geminiKeyCursor = 0;
  const callGeminiVision = async (payload) => {
    if (!geminiApiKeys.length) {
      const error = new Error("Gemini is not configured.");
      error.status = 503;
      throw error;
    }
    let lastError;
    for (let attempt = 0; attempt < geminiApiKeys.length; attempt += 1) {
      const apiKey = geminiApiKeys[geminiKeyCursor++ % geminiApiKeys.length];
      if ((geminiKeyCooldowns.get(apiKey) || 0) > Date.now()) continue;
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiVisionModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(35_000),
            body: JSON.stringify(payload),
          },
        );
        const body = await response.json().catch(() => ({}));
        if (response.ok) return body;
        lastError = new Error(
          body?.error?.message || "Gemini could not read this result sheet.",
        );
        lastError.status = response.status;
        if ([401, 403, 429].includes(response.status) || response.status >= 500) {
          geminiKeyCooldowns.set(
            apiKey,
            Date.now() + (response.status >= 500 ? 30_000 : 15 * 60_000),
          );
          continue;
        }
        throw lastError;
      } catch (error) {
        if (error.status && error.status < 500 && error.status !== 429)
          throw error;
        lastError = error;
        geminiKeyCooldowns.set(apiKey, Date.now() + 15_000);
      }
    }
    if (!lastError) {
      lastError = new Error("All Gemini keys are cooling down.");
      lastError.status = 429;
    }
    throw lastError;
  };
  const callGroq = async (prompt, model) => {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_completion_tokens: 700,
        }),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || "Groq request failed");
      error.status = response.status;
      throw error;
    }
    return body.choices?.[0]?.message?.content || "";
  };
  const callGroqWithFallback = async (prompt) => {
    try {
      return {
        text: await callGroq(prompt, groqPrimaryModel),
        model: groqPrimaryModel,
      };
    } catch (primaryError) {
      console.error(
        "[groq] primary failed:",
        primaryError.status || "",
        primaryError.message,
      );
      return {
        text: await callGroq(prompt, groqFallbackModel),
        model: groqFallbackModel,
      };
    }
  };
  const normalizeNewsTitle = (value, articleUrl = "") => {
    const normalized = sanitizeString(
      String(value || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]{2,})([a-z])/g, "$1 $2")
        .replace(/([A-Za-z])([0-9])/g, "$1 $2")
        .replace(/([0-9])([A-Za-z])/g, "$1 $2")
        .replace(/:\s*/g, ": ")
        .replace(/\s*[-–—]\s*/g, " — "),
    );
    if ((normalized.match(/\s/g) || []).length < 2 && articleUrl) {
      try {
        const parts = new URL(articleUrl).pathname.split("/").filter(Boolean);
        const slug = decodeURIComponent(parts.at(-1) || "")
          .replace(/\.(?:html?|ece|php|aspx?)$/i, "")
          .replace(/[-_]+/g, " ")
          .replace(/\b\d{7,}\b.*$/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if ((slug.match(/\s/g) || []).length >= 2 && /[A-Za-z]/.test(slug)) {
          return sanitizeString(slug.charAt(0).toUpperCase() + slug.slice(1));
        }
      } catch {
        // Keep the provider title when its URL is opaque or malformed.
      }
    }
    return normalized;
  };
  const normalizeNewsDate = (value) => {
    const raw = String(value || "").trim();
    const compact = raw.match(
      /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/,
    );
    const date = compact
      ? new Date(
          Date.UTC(
            Number(compact[1]),
            Number(compact[2]) - 1,
            Number(compact[3]),
            Number(compact[4] || 0),
            Number(compact[5] || 0),
            Number(compact[6] || 0),
          ),
        )
      : new Date(raw);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  };
  const isOyoStateNews = (value) => {
    const text = String(value || "");
    const isHotelCompany =
      /\boyo[\s\-–—]*parent\b|\boyo[\s\-–—]*hotels?\b|\bhospitality\b|\bhotels?\b|\bprism\b|\bipo\b|\brooms?\b/i.test(
        text,
      );
    if (isHotelCompany) return false;
    if (/\boyo state\b|\bibadan\b/i.test(text)) return true;
    const hasBareOyo = /\boyo\b/i.test(text);
    const hasLocalContext =
      /\bnigeria(?:n)?\b|\binec\b|\bmakinde\b|\bgovern(?:or|ment|ance)\b|\bstate assembly\b|\bcommissioner\b|\bpolice\b|\bsecurity\b|\bcp\b|\blga\b|\blocal government\b|\bmonarchs?\b|\bresidents?\b|\bpolitic(?:s|al)?\b|\belections?\b|\bapc\b|\bpdp\b|\blabour party\b/i.test(
        text,
      );
    return hasBareOyo && hasLocalContext;
  };

  // In-memory IP log — stores last 500 entries (incident + SOS submissions)

  return { openAiPrimaryModel, openAiFallbackModel, groqPrimaryModel, groqFallbackModel, groqNewsModel, geminiVisionModel, geminiApiKeys, callGeminiVision, callGroq, callGroqWithFallback, normalizeNewsTitle, normalizeNewsDate, isOyoStateNews };
}
