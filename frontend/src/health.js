const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1';

/**
 * Resolves the configured backend base URL from environment variables
 * or falls back to the default local URL.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function getApiBaseUrl(env = import.meta.env || {}) {
  const rawUrl = env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
  return rawUrl.replace(/\/+$/, '');
}

/**
 * Calls GET /health on the configured backend API.
 *
 * @param {typeof fetch} [httpClient] - Fetch-compatible function for HTTP requests.
 * @param {string} [baseUrl] - Base URL of the backend API.
 * @returns {Promise<boolean>} True if the backend responds with HTTP 2xx, false otherwise.
 */
export async function checkBackendHealth(
  httpClient = fetch,
  baseUrl = getApiBaseUrl()
) {
  try {
    const response = await httpClient(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    return Boolean(response && response.ok);
  } catch {
    return false;
  }
}