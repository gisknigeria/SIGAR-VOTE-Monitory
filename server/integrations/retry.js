const DEFAULT_RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Bounded retry with exponential backoff for transient external-provider
 * failures. Only retries errors whose `.status`/`.statusCode` is in the
 * retryable set (rate limits, timeouts, 5xx) -- everything else (4xx, bad
 * payloads) fails immediately rather than being retried into a worse state.
 * `sleep` and the retry set are injectable so callers/tests never depend on
 * real wall-clock waits or a live provider.
 */
export async function requestWithRetry(operation, { attempts = 4, retryableStatus = DEFAULT_RETRYABLE_STATUS, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), baseDelayMs = 500, maxDelayMs = 60_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const status = Number(error.status || error.statusCode || 0);
      if (!retryableStatus.has(status) || attempt === attempts) throw error;
      const retryAfter = Number(error.retryAfterMs || 0);
      await sleep(retryAfter || Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

export { DEFAULT_RETRYABLE_STATUS };
