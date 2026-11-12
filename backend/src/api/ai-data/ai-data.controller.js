import { getSnapshot as getSnapshotService } from '../../application/ai-data/ai-data.service.js';

export async function getSnapshot(req, res, next, aiDataRepository, query = {}) {
  try {
    const { scenarioId, stockMode } = query;
    const params = scenarioId ? { scenarioId, stockMode } : {};
    res.json(await getSnapshotService(aiDataRepository, undefined, params));
  } catch (err) {
    next(err);
  }
}
