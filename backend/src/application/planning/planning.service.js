import { AppError } from '../app-error.js';

/**
 * Planning use cases (AI05/WEB07): Bill of Materials and Requirements Planning, calculated by
 * the Prolog AI service.
 *
 * Never changes stock nor purchase orders: results are simulations (`simulation: true`).
 * The only thing written is the planning run itself (its own collection), so every result can
 * be consulted later together with the exact inputs it used: forecast version, supplier
 * scenario version, stock snapshot and BOM (catalogue) version.
 *
 * @param {{
 *   loadSnapshot: (params: {scenarioId: string, stockMode: string, forecastId?: string, supplierScenarioId?: string}) => Promise<object>,
 *   aiServiceClient: {calculate: (kind: string, request: object, snapshot: object) => Promise<object>},
 *   planningRunRepository?: {create: Function, list: Function, findById: Function},
 * }} deps without planningRunRepository the results are returned but not recorded
 */
export function createPlanningService({ loadSnapshot, aiServiceClient, planningRunRepository }) {
  if (typeof loadSnapshot !== 'function') throw new Error('loadSnapshot is required.');
  if (!aiServiceClient) throw new Error('aiServiceClient is required.');

  async function calculate(kind, { scenarioId, stockMode, forecastId, supplierScenarioId }, ctx) {
    // The AI service receives the same request as before; the chosen saved forecast and supplier
    // scenario only select which data the snapshot carries (and are recorded in its sources).
    const request = { scenarioId, stockMode };
    // 404 AI_SCENARIO_NOT_FOUND / FORECAST_NOT_FOUND / SUPPLIER_SCENARIO_NOT_FOUND and
    // 400 SCENARIO_WITHOUT_STOCK are raised by the snapshot service.
    const snapshot = await loadSnapshot({
      ...request,
      ...(forecastId ? { forecastId } : {}),
      ...(supplierScenarioId ? { supplierScenarioId } : {}),
    });
    const result = await aiServiceClient.calculate(kind, request, snapshot);
    if (!planningRunRepository) return result;

    const run = await planningRunRepository.create(
      toPlanningRunRecord(
        kind,
        { ...request, forecastId, supplierScenarioId },
        snapshot,
        result,
        ctx,
      ),
    );
    return { ...result, runId: String(run._id ?? run.id) };
  }

  function requireRepository() {
    if (!planningRunRepository) throw new Error('planningRunRepository is required.');
    return planningRunRepository;
  }

  return {
    calculateBom: (params, ctx) => calculate('bom', params, ctx),
    calculateRequirements: (params, ctx) => calculate('requirements', params, ctx),
    listRuns: async (filters = {}) =>
      (await requireRepository().list(filters)).map(toPlanningRunSummaryDto),
    getRun: async (id) => {
      const run = await requireRepository().findById(id);
      if (!run) throw new AppError('Planning run not found.', 404, null, 'PLANNING_RUN_NOT_FOUND');
      return toPlanningRunDto(run);
    },
  };
}

/** { id, name, version } of a planning input carried by the snapshot (null when absent). */
const inputVersion = (input) =>
  input ? { id: String(input.id), name: input.name, version: input.version } : null;

/**
 * What is recorded for one run: the request, the versions of every input (taken from the
 * snapshot the back end built, not from the AI answer) and the full result.
 */
export function toPlanningRunRecord(kind, request, snapshot, result, { requestedBy } = {}) {
  const meta = snapshot?.meta ?? {};
  return {
    kind,
    request: {
      scenarioId: request.scenarioId,
      stockMode: request.stockMode,
      forecastId: request.forecastId ?? null,
      supplierScenarioId: request.supplierScenarioId ?? null,
    },
    snapshotId: meta.snapshotId ?? null,
    scenario: snapshot?.scenario ?? null,
    forecast: inputVersion(snapshot?.forecast),
    supplierScenario: inputVersion(snapshot?.supplierScenario),
    bomVersion: meta.sources?.catalogue?.version ?? null,
    stockSource: meta.sources?.stock ?? null,
    status: result?.status ?? 'unknown',
    result,
    requestedBy: requestedBy ?? null,
  };
}

const toDate = (value) => (value instanceof Date ? value.toISOString() : (value ?? null));

function baseDto(run) {
  return {
    id: String(run._id ?? run.id),
    kind: run.kind,
    createdAt: toDate(run.createdAt),
    requestedBy: run.requestedBy ?? null,
    request: run.request,
    snapshotId: run.snapshotId ?? null,
    scenario: run.scenario ?? null,
    forecast: run.forecast ?? null,
    supplierScenario: run.supplierScenario ?? null,
    bomVersion: run.bomVersion ?? null,
    stockSource: run.stockSource ?? null,
    status: run.status,
  };
}

/** List entry: associations and the summary of the result, without the full plan. */
export function toPlanningRunSummaryDto(run) {
  return {
    ...baseDto(run),
    summary: run.result?.summary ?? null,
    feasible: run.result?.summary?.feasible ?? run.result?.feasible ?? null,
  };
}

export function toPlanningRunDto(run) {
  return { ...baseDto(run), result: run.result };
}
