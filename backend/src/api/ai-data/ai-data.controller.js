import {
  getProductsExport as getProductsExportService,
  getSnapshot as getSnapshotService,
} from '../../application/ai-data/ai-data.service.js';

const OPTIONAL_KEYS = ['scenarioId', 'stockMode', 'forecastId', 'supplierScenarioId'];

export async function getSnapshot(req, res, next, aiDataRepository, query = {}) {
  try {
    // Only the keys that were sent; forecastId/supplierScenarioId select a saved version (WEB07).
    const params = Object.fromEntries(
      OPTIONAL_KEYS.filter((key) => query[key] !== undefined).map((key) => [key, query[key]]),
    );
    res.json(await getSnapshotService(aiDataRepository, undefined, params));
  } catch (err) {
    next(err);
  }
}

export async function getProductsExport(req, res, next, aiDataRepository) {
  try {
    res.json(await getProductsExportService(aiDataRepository));
  } catch (err) {
    next(err);
  }
}
