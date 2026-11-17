export async function calculateBom(req, res, next, planningService, params) {
  try {
    res.json(await planningService.calculateBom(params));
  } catch (err) {
    next(err);
  }
}

export async function calculateRequirements(req, res, next, planningService, params) {
  try {
    res.json(await planningService.calculateRequirements(params));
  } catch (err) {
    next(err);
  }
}
