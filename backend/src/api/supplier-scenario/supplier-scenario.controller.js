import * as supplierScenarioService from '../../application/supplier-scenario/supplier-scenario.service.js';

export const list = async (req, res, next, scenarioRepository) => {
  try {
    const scenarios = await supplierScenarioService.listSupplierScenarios(req.query, scenarioRepository);
    res.status(200).json(scenarios);
  } catch (error) { next(error); }
};

export const create = async (req, res, next, scenarioRepository) => {
  try {
    const scenario = await supplierScenarioService.createSupplierScenario(req.body, scenarioRepository);
    res.status(201).json(scenario);
  } catch (error) { next(error); }
};

export const getById = async (req, res, next, scenarioRepository) => {
  try {
    const scenario = await supplierScenarioService.getSupplierScenarioById(req.params.id, scenarioRepository);
    res.status(200).json(scenario);
  } catch (error) { next(error); }
};

export const update = async (req, res, next, scenarioRepository) => {
  try {
    const scenario = await supplierScenarioService.updateSupplierScenario(req.params.id, req.body, scenarioRepository);
    res.status(200).json(scenario);
  } catch (error) { next(error); }
};
