import { getSnapshot as getSnapshotService } from '../../application/ai-data/ai-data.service.js';

export async function getSnapshot(req, res, next, aiDataRepository) {
  try {
    res.json(await getSnapshotService(aiDataRepository));
  } catch (err) {
    next(err);
  }
}
