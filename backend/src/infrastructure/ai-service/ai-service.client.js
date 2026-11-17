import { AppError } from '../../application/app-error.js';

/** Calculations exposed by the Prolog service (AI05). */
export const AiCalculation = Object.freeze({ BOM: 'bom', REQUIREMENTS: 'requirements' });

const KNOWN = new Set(Object.values(AiCalculation));
const RETRY_AFTER_SECONDS = 5;

function unavailable(reason, aiServiceStatus) {
  const details = { reason };
  if (Number.isInteger(aiServiceStatus)) details.aiServiceStatus = aiServiceStatus;
  const err = new AppError('The AI service is not available.', 503, details, 'AI_SERVICE_UNAVAILABLE');
  err.retryAfterSeconds = RETRY_AFTER_SECONDS;
  return err;
}

function timedOut() {
  return new AppError(
    'The AI service did not answer in time.',
    504,
    { reason: 'timeout' },
    'AI_SERVICE_TIMEOUT',
  );
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * HTTP client of the Prolog AI service. The back end is the only caller: it authenticates with
 * a service key (X-Api-Key) and sends the snapshot in the body, so the AI service never receives
 * a user token nor calls the back end.
 *
 * Error mapping (status seen by the SPA):
 *   422 from the AI service           -> 422, same code/details (AI_INVALID_DATA: data incomplete)
 *   connection refused / bad answer   -> 503 (details.reason), with Retry-After
 *   no answer within timeoutMs        -> 504
 *   401/403 from the AI service       -> 503 service_auth_failed (misconfigured key; logged)
 *
 * @param {{baseUrl: string, apiKey?: string, timeoutMs?: number,
 *          fetchImpl?: typeof fetch, logger?: Pick<Console, 'error'>}} options
 */
export function createAiServiceClient({
  baseUrl,
  apiKey,
  timeoutMs = 15_000,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  if (!baseUrl) throw new Error('AI service URL is not configured.');
  const root = baseUrl.replace(/\/+$/, '');

  /**
   * @param {'bom'|'requirements'} kind
   * @param {{scenarioId: string, stockMode: 'live'|'scenario'}} request
   * @param {object} snapshot - Result of the ai-data snapshot service.
   * @returns {Promise<object>} The calculation result (status "ok").
   */
  async function calculate(kind, request, snapshot) {
    if (!KNOWN.has(kind)) throw new Error(`Unknown AI calculation: ${kind}`);
    if (!apiKey) {
      logger.error('AI_SERVICE_KEY is not configured: AI calculations are disabled.');
      throw unavailable('not_configured');
    }

    let response;
    try {
      response = await fetchImpl(`${root}/service/${kind}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({ request, snapshot }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') throw timedOut();
      throw unavailable('connection_failed');
    }

    const body = await readJson(response);

    if (response.status === 200) {
      if (body && body.status === 'ok') return body;
      throw unavailable('invalid_ai_response', 200);
    }
    if (response.status === 422 && body?.error) {
      const { code, message, details } = body.error;
      throw new AppError(
        message ?? 'The data needed for the calculation is invalid or incomplete.',
        422,
        details ?? null,
        code ?? 'AI_INVALID_DATA',
      );
    }
    if (response.status === 401 || response.status === 403) {
      logger.error('The AI service rejected the service key (check AI_SERVICE_KEY on both sides).');
      throw unavailable('service_auth_failed', response.status);
    }
    if (response.status === 400) {
      // The back end validates the same request: a 400 here is a contract mismatch, not user input.
      logger.error('The AI service rejected the request contract.', body?.error?.details);
    }
    throw unavailable(body ? 'ai_service_error' : 'invalid_ai_response', response.status);
  }

  return { calculate };
}
