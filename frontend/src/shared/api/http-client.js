export class ApiError extends Error {
  constructor(message, { status = 0, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
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

export function createHttpClient({
  baseUrl,
  getToken = () => null,
  fetchFn = (...args) => globalThis.fetch(...args),
}) {
  async function request(path, { method = 'GET', query, body, signal } = {}) {
    const headers = { Accept: 'application/json' };
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetchFn(buildUrl(baseUrl, path, query), {
        method,
        headers,
        body:
          body !== undefined && body !== null
            ? JSON.stringify(body)
            : undefined,
        signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      throw new ApiError('Network Error: Unable to reach the server', {
        status: 0,
      });
    }

    const data = await readBody(response);
    if (!response.ok) {
      const message = extractMessage(data, response.status);
      throw new ApiError(message, {
        status: response.status,
        details: data?.errors ?? data?.details ?? null,
      });
    }
    return data;
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
