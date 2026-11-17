import { api } from '../../../shared/api/index.js';

/** The back end waits up to AI_SERVICE_TIMEOUT_SECONDS (15 s) for the AI service. */
const PLANNING_TIMEOUT_MS = 30_000;

export const PlanningKind = Object.freeze({ BOM: 'bom', REQUIREMENTS: 'requirements' });

/**
 * POST /planning/{bom|requirements} (AI05). Calculation only: never changes stock nor creates
 * purchase orders. Every failure is shown inline by the panel, so no global toast.
 *
 * @param {'bom'|'requirements'} kind
 * @param {{scenarioId: string, stockMode: 'live'|'scenario'}} body
 * @param {AbortSignal} [signal]
 */
export function calculatePlanning(kind, body, signal) {
  if (!Object.values(PlanningKind).includes(kind)) {
    throw new Error(`Unknown planning calculation: ${kind}`);
  }
  return api.post(`/planning/${kind}`, body, {
    signal,
    feedback: 'silent',
    timeoutMs: PLANNING_TIMEOUT_MS,
  });
}
