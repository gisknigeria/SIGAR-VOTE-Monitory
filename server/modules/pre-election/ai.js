/**
 * Sends one prompt to the configured AI providers, Gemini first (asked for JSON), then Groq,
 * then OpenAI, and returns the first usable text. Mirrors the voter survey's provider order.
 */
export async function askModels(prompt, { geminiApiKeys = [], callGroqWithFallback = null, openAiPrimaryModel = '', fetchImpl = fetch } = {}) {
  const errors = [];
  if (geminiApiKeys.length) {
    const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.6-flash', process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite'])];
    for (const model of models) {
      for (const apiKey of geminiApiKeys) {
        try {
          const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4000, responseMimeType: 'application/json' } }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body?.error?.message || `Gemini returned ${response.status}`);
          const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
          if (text.trim()) return { text, provider: 'gemini', model };
        } catch (error) { errors.push(`gemini ${model}: ${error.message}`); }
      }
    }
  }
  if (process.env.GROQ_API_KEY && callGroqWithFallback) {
    try {
      const result = await callGroqWithFallback(prompt);
      if (String(result.text || '').trim()) return { text: result.text, provider: 'groq', model: result.model };
    } catch (error) { errors.push(`groq: ${error.message}`); }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = openAiPrimaryModel || process.env.OPENAI_MODEL || 'gpt-5.6-terra';
      const response = await fetchImpl('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: prompt, max_output_tokens: 4000 }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || `OpenAI returned ${response.status}`);
      const text = body.output_text || body.output?.flatMap((item) => item.content || []).map((item) => item.text || '').join('') || '';
      if (text.trim()) return { text, provider: 'openai', model };
    } catch (error) { errors.push(`openai: ${error.message}`); }
  }
  for (const error of errors) console.error('[next-actions]', error);
  return null;
}
