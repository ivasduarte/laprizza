/**
 * Planning use cases (AI05): Bill of Materials and Requirements Planning, calculated by the
 * Prolog AI service.
 *
 * Read-only by construction: the only dependencies are a snapshot reader and the AI client.
 * Results are simulations (`simulation: true`); stock and purchase orders are never changed
 * here. Applying a result must go through the responsible back-end use case, explicitly.
 *
 * @param {{
 *   loadSnapshot: (params: {scenarioId: string, stockMode: string}) => Promise<object>,
 *   aiServiceClient: {calculate: (kind: string, request: object, snapshot: object) => Promise<object>},
 * }} deps
 */
export function createPlanningService({ loadSnapshot, aiServiceClient }) {
  if (typeof loadSnapshot !== 'function') throw new Error('loadSnapshot is required.');
  if (!aiServiceClient) throw new Error('aiServiceClient is required.');

  async function calculate(kind, { scenarioId, stockMode }) {
    const request = { scenarioId, stockMode };
    // 404 AI_SCENARIO_NOT_FOUND / 400 SCENARIO_WITHOUT_STOCK are raised by the snapshot service.
    const snapshot = await loadSnapshot(request);
    return aiServiceClient.calculate(kind, request, snapshot);
  }

  return {
    calculateBom: (params) => calculate('bom', params),
    calculateRequirements: (params) => calculate('requirements', params),
  };
}
