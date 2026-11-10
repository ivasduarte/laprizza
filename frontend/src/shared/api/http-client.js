export class ApiError extends Error {
  constructor(
    message,
    { status = 0, details = null, code = null, retryAfterSeconds = null } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function buildUrl(baseUrl, path, query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  return `${baseUrl}${path}${params.toString() ? `?${params.toString()}` : ''}`;
}

async function readBody(response) {
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers?.get?.('content-type') || '';
  if (!contentType.includes('json')) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractMessage(data, status) {
  const candidate = data?.message ?? data?.error?.message ?? data?.error;
  return typeof candidate === 'string' && candidate
    ? candidate
    : `Request failed with status ${status}`;
}

function extractRetryAfter(response) {
  const seconds = Number(response.headers?.get?.('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

const hasBody = (body) => body !== undefined && body !== null;

export function createHttpClient({
  baseUrl,
  getToken = () => null,
  fetchFn = (...args) => globalThis.fetch(...args),
  refreshAccessToken = null,
  onSessionExpired = null,
}) {
  /**
   * @param {string} path
   * @param {object} [options]
   * @param {string} [options.contentType] - Se definido, o body é enviado tal como está (ex.: um File)
   *   com este Content-Type, em vez de ser serializado como JSON.
   * @param {'json'|'blob'} [options.responseType='json'] - 'blob' devolve o corpo da resposta como Blob.
   * @param {boolean} [options.withStatus=false] - Devolve { status, data } em vez de só os dados.
   */
  async function request(path, options = {}) {
    const {
      method = 'GET',
      query,
      body,
      signal,
      auth = true,
      credentials,
      contentType,
      responseType = 'json',
      withStatus = false,
      isRetry = false,
    } = options;

    const headers = {
      Accept: responseType === 'blob' ? '*/*' : 'application/json',
    };
    const token = auth ? getToken() : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (hasBody(body)) {
      headers['Content-Type'] = contentType ?? 'application/json';
    }

    let response;
    try {
      response = await fetchFn(buildUrl(baseUrl, path, query), {
        method,
        headers,
        body: hasBody(body)
          ? contentType
            ? body
            : JSON.stringify(body)
          : undefined,
        signal,
        ...(credentials ? { credentials } : {}),
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      throw new ApiError('Network Error: Unable to reach the server', {
        status: 0,
      });
    }

    if (!response.ok) {
      const data = await readBody(response);
      const error = new ApiError(extractMessage(data, response.status), {
        status: response.status,
        details: data?.errors ?? data?.details ?? data?.error?.details ?? null,
        code: data?.error?.code ?? null,
        retryAfterSeconds: extractRetryAfter(response),
      });

      if (response.status === 401 && token) {
        if (error.code === 'TOKEN_EXPIRED' && refreshAccessToken && !isRetry) {
          const refreshed = await refreshAccessToken().catch(() => false);
          if (refreshed) {
            return request(path, { ...options, isRetry: true });
          }
        }
        onSessionExpired?.();
      }
      throw error;
    }

    const data =
      responseType === 'blob' && response.status !== 204
        ? await response.blob()
        : await readBody(response);
    return withStatus ? { status: response.status, data } : data;
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) =>
      request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) =>
      request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) =>
      request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
}
