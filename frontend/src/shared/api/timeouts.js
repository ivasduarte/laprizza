export const DEFAULT_READ_TIMEOUT_MS = 15_000;
export const DEFAULT_WRITE_TIMEOUT_MS = 30_000;

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * Timeouts (ms) from the Vite environment: reads and writes (POST/PUT/PATCH/DELETE).
 * @param {Record<string, string | undefined>} [env]
 */
export function getHttpTimeouts(env = import.meta.env || {}) {
  return {
    timeoutMs: positiveNumber(
      env.VITE_HTTP_TIMEOUT_MS,
      DEFAULT_READ_TIMEOUT_MS
    ),
    mutationTimeoutMs: positiveNumber(
      env.VITE_HTTP_MUTATION_TIMEOUT_MS,
      DEFAULT_WRITE_TIMEOUT_MS
    ),
  };
}
