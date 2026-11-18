const context = (req) => ({ requestedBy: req.user?.userId ?? null });

export async function calculateBom(req, res, next, planningService, params) {
  try {
    res.json(await planningService.calculateBom(params, context(req)));
  } catch (err) {
    next(err);
  }
}

export async function calculateRequirements(req, res, next, planningService, params) {
  try {
    res.json(await planningService.calculateRequirements(params, context(req)));
  } catch (err) {
    next(err);
  }
}

export async function listRuns(req, res, next, planningService, filters) {
  try {
    res.json(await planningService.listRuns(filters));
  } catch (err) {
    next(err);
  }
}

export async function getRun(req, res, next, planningService) {
  try {
    res.json(await planningService.getRun(req.params.id));
  } catch (err) {
    next(err);
  }
}
