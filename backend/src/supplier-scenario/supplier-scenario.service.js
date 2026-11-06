import * as defaultSupplierScenarioRepository from '../../infrastructure/supplier-scenario/supplier-scenario.repository.js';
import { AppError } from '../app-error.js';

export function toSupplierScenarioDto(scenario) {
  return {
    id: scenario._id || scenario.id,
    name: scenario.name,
    version: scenario.version,
    simulated: scenario.simulated,
    suppliers: scenario.suppliers,
    products: scenario.products,
    isActive: scenario.isActive !== false,
  };
}

export async function listSupplierScenarios(filters = {}, scenarioRepository = defaultSupplierScenarioRepository) {
  const scenarios = filters.name
    ? await scenarioRepository.search(filters.name)
    : await scenarioRepository.list();
  return scenarios.filter((s) => s.isActive !== false).map(toSupplierScenarioDto);
}

export async function getSupplierScenarioById(id, scenarioRepository = defaultSupplierScenarioRepository) {
  const scenario = await scenarioRepository.findById(id);
  if (!scenario || scenario.isActive === false) throw new AppError('Supplier Scenario not found.', 404);
  return toSupplierScenarioDto(scenario);
}

export async function createSupplierScenario(scenarioData, scenarioRepository = defaultSupplierScenarioRepository) {
  try {
    const newScenario = await scenarioRepository.create({ ...scenarioData, isActive: true });
    return toSupplierScenarioDto(newScenario);
  } catch (err) {
    if (err.code === 11000) throw new AppError('Supplier Scenario name already in use.', 409);
    throw err;
  }
}

export async function updateSupplierScenario(id, updateData, scenarioRepository = defaultSupplierScenarioRepository) {
  if (updateData.isActive !== false) throw new AppError('Only deactivation is supported.', 400);
  const scenario = await scenarioRepository.findById(id);
  if (!scenario || scenario.isActive === false) throw new AppError('Supplier Scenario not found.', 404);
  
  const deactivated = await scenarioRepository.update(id, { isActive: false });
  return toSupplierScenarioDto(deactivated);
}
