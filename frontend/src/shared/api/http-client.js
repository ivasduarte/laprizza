import {
  DEFAULT_READ_TIMEOUT_MS,
  DEFAULT_WRITE_TIMEOUT_MS,
} from './timeouts.js';

export class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      details = null,
      code = null,
      retryAfterSeconds = null,
      outcomeUnknown = false,
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    /** A write was sent but no answer arrived: it may already have been executed. */
    this.outcomeUnknown = outcomeUnknown;
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
const SAFE_METHODS = new Set(['GET', 'HEAD']);

/** Feedback hooks must never break a request or leave a loader stuck. */
function safely(hook, ...args) {
  try {
    hook?.(...args);
  } catch {
    /* ignored on purpose */
  }
}

/**
 * @param {Object} config
 * @param {number} [config.timeoutMs] - Limit for reads (GET/HEAD).
 * @param {number} [config.mutationTimeoutMs] - Limit for writes.
 * @param {(meta: {method: string, path: string, feedback: string}) => void} [config.onRequestStart]
 * @param {(meta: object) => void} [config.onRequestEnd] - Always called: success, failure, abort, timeout.
 * @param {(error: Error, meta: object) => void} [config.onError] - Once per failed request (not on caller aborts).
 */
export function createHttpClient({
  baseUrl,
  getToken = () => null,
  fetchFn = (...args) => globalThis.fetch(...args),
  refreshAccessToken = null,
  onSessionExpired = null,
  timeoutMs = DEFAULT_READ_TIMEOUT_MS,
  mutationTimeoutMs = DEFAULT_WRITE_TIMEOUT_MS,
  onRequestStart = null,
  onRequestEnd = null,
  onError = null,
}) {
  async function execute(path, options = {}) {
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
      timeoutMs: timeoutOverride,
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

    const isWrite = !SAFE_METHODS.has(method);
    const limit = timeoutOverride ?? (isWrite ? mutationTimeoutMs : timeoutMs);
    const controller = new AbortController();
    let timedOut = false;
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limit);
    const forwardAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener?.('abort', forwardAbort, { once: true });

    const timeoutError = () =>
      new ApiError('Request timed out', {
        status: 0,
        code: 'TIMEOUT',
        outcomeUnknown: isWrite,
      });

    try {
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
          signal: controller.signal,
          ...(credentials ? { credentials } : {}),
        });
      } catch (error) {
        if (timedOut) throw timeoutError();
        if (error.name === 'AbortError') {
          throw error;
        }
        throw new ApiError('Network Error: Unable to reach the server', {
          status: 0,
          code: 'NETWORK_ERROR',
          outcomeUnknown: isWrite,
        });
      }

      // The timeout also covers reading the body (a stalled download must not hang).
      const readsBlob =
        response.ok && responseType === 'blob' && response.status !== 204;
      let data;
      try {
        data = readsBlob ? await response.blob() : await readBody(response);
      } catch (error) {
        if (timedOut) throw timeoutError();
        throw error;
      }
      if (timedOut) throw timeoutError();
      if (controller.signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      if (!response.ok) {
        const error = new ApiError(extractMessage(data, response.status), {
          status: response.status,
          details:
            data?.errors ?? data?.details ?? data?.error?.details ?? null,
          code: data?.error?.code ?? null,
          retryAfterSeconds: extractRetryAfter(response),
        });

        if (response.status === 401 && token) {
          if (
            error.code === 'TOKEN_EXPIRED' &&
            refreshAccessToken &&
            !isRetry
          ) {
            globalThis.clearTimeout(timer); // the retry gets its own timeout
            const refreshed = await refreshAccessToken().catch(() => false);
            if (refreshed) {
              return execute(path, { ...options, isRetry: true });
            }
          }
          onSessionExpired?.();
        }
        throw error;
      }

      return withStatus ? { status: response.status, data } : data;
    } finally {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener?.('abort', forwardAbort);
    }
  }

  /**
   * Single gateway for every API call (WEB04): feeds the pending-request counter and reports failures.
   *
   * @param {string} path
   * @param {object} [options]
   * @param {string} [options.contentType] - Se definido, o body é enviado tal como está (ex.: um File)
   *   com este Content-Type, em vez de ser serializado como JSON.
   * @param {'json'|'blob'} [options.responseType='json'] - 'blob' devolve o corpo da resposta como Blob.
   * @param {boolean} [options.withStatus=false] - Devolve { status, data } em vez de só os dados.
   * @param {number} [options.timeoutMs] - Substitui o timeout por omissão deste pedido.
   * @param {'auto'|'silent'} [options.feedback='auto'] - 'silent' mantém a falha fora dos toasts globais.
   */
  async function request(path, options = {}) {
    const meta = {
      method: options.method ?? 'GET',
      path,
      feedback: options.feedback ?? 'auto',
    };
    safely(onRequestStart, meta);
    try {
      return await execute(path, options);
    } catch (error) {
      if (error?.name !== 'AbortError') safely(onError, error, meta);
      throw error;
    } finally {
      safely(onRequestEnd, meta);
    }
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
