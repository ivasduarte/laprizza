import PlanningRun from './planning-run.model.js';

const MAX_LISTED = 100;

/** Fields of the list: everything except the full result (only its summary). */
const SUMMARY_FIELDS =
  'kind request snapshotId scenario forecast supplierScenario bomVersion stockSource status ' +
  'requestedBy createdAt result.summary result.feasible';

export async function create(data) {
  return PlanningRun.create(data);
}

/** Most recent first; optional filters: kind, forecastId, supplierScenarioId. */
export async function list({ kind, forecastId, supplierScenarioId } = {}) {
  const filter = {};
  if (kind) filter.kind = kind;
  if (forecastId) filter['forecast.id'] = forecastId;
  if (supplierScenarioId) filter['supplierScenario.id'] = supplierScenarioId;
  return PlanningRun.find(filter, SUMMARY_FIELDS).sort({ createdAt: -1 }).limit(MAX_LISTED).lean();
}

export async function findById(id) {
  return PlanningRun.findById(id).lean();
}
