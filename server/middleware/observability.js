import { randomUUID } from 'node:crypto';

const REDACTED_KEYS = new Set(['password', 'token', 'authorization', 'secret', 'apikey', 'api_key', 'jwt', 'cookie', 'originaldata', 'data']);

/** Deep-redacts known-sensitive keys so a logged object never carries a credential, token, or evidence payload. */
export function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[redacted]' : redact(entry, depth + 1);
  }
  return result;
}

/** Assigns a per-request correlation id, echoed back as X-Request-Id, so a log line and a client-reported error can be tied together. */
export function requestId() {
  return (req, res, next) => {
    req.id = req.headers['x-request-id'] && /^[a-z0-9-]{1,64}$/i.test(req.headers['x-request-id']) ? req.headers['x-request-id'] : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}

/** A structured log line: JSON with requestId/timestamp/level, and redacted details -- not a replacement for every console.* call in the codebase, but the pattern the global error handler and other new call sites should follow. */
export function logEvent(level, message, { requestId: id = '', ...details } = {}) {
  const line = { level, message, requestId: id, at: new Date().toISOString(), ...redact(details) };
  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  target(JSON.stringify(line));
}
