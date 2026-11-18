import * as defaultSupplierScenarioRepository from '../../infrastructure/supplier-scenario/supplier-scenario.repository.js';
import { AppError } from '../app-error.js';
import { findSupplierScenarioProblems } from './supplier-scenario.rules.js';

export function toSupplierScenarioDto(scenario) {
  return {
    id: String(scenario._id ?? scenario.id),
    name: scenario.name,
    version: scenario.version,
    simulated: scenario.simulated,
    suppliers: (scenario.suppliers ?? []).map((s) => ({ id: s.id, name: s.name })),
    products: (scenario.products ?? []).map((p) => ({
      productId: String(p.productId),
      offers: (p.offers ?? []).map((o) => ({
        supplierId: o.supplierId,
        priceEur: o.priceEur,
        stockUnits: o.stockUnits,
        leadTimeDays: o.leadTimeDays,
        ...(o.supplyLimit === undefined || o.supplyLimit === null
          ? {}
          : { supplyLimit: o.supplyLimit }),
      })),
    })),
    isActive: scenario.isActive !== false,
  };
}

export async function listSupplierScenarios(
  filters = {},
  scenarioRepository = defaultSupplierScenarioRepository,
) {
  const scenarios = filters.name
    ? await scenarioRepository.search(filters.name)
    : await scenarioRepository.list();

  const activeScenarios = scenarios.filter((s) => s.isActive !== false);
  return activeScenarios.map(toSupplierScenarioDto);
}

export async function getSupplierScenarioById(
  id,
  scenarioRepository = defaultSupplierScenarioRepository,
) {
  const scenario = await scenarioRepository.findById(id);

  if (!scenario || scenario.isActive === false) {
    throw new AppError('Supplier Scenario not found.', 404);
  }

  return toSupplierScenarioDto(scenario);
}

/**
 * Creates a supplier scenario. Immutable and versioned like forecasts: an existing name creates
 * the next version. Offers come from manual or LLM-prepared JSON, so they are always simulated.
 * A supplier without name uses its id as name.
 */
export async function createSupplierScenario(
  scenarioData,
  scenarioRepository = defaultSupplierScenarioRepository,
  catalogueReader,
) {
  if (!catalogueReader) throw new Error('catalogueReader is required.');
  const products = await catalogueReader.listProducts();
  const problems = findSupplierScenarioProblems(scenarioData, { products });
  if (problems.length > 0) {
    throw new AppError('Validation failed.', 400, problems, 'VALIDATION_ERROR');
  }

  const { name, suppliers, products: offersByProduct } = scenarioData;
  const version = (await scenarioRepository.getLatestVersion(name)) + 1;
  try {
    const created = await scenarioRepository.create({
      name,
      version,
      simulated: true,
      suppliers: suppliers.map((s) => ({ id: s.id, name: s.name?.trim() || s.id })),
      products: offersByProduct,
      isActive: true,
    });
    return toSupplierScenarioDto(created);
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('Supplier Scenario version already exists. Try again.', 409);
    }
    throw err;
  }
}

export async function updateSupplierScenario(
  id,
  updateData,
  scenarioRepository = defaultSupplierScenarioRepository,
) {
  if (updateData.isActive !== false) {
    throw new AppError('Only deactivation is supported: isActive must be false.', 400);
  }

  const scenario = await scenarioRepository.findById(id);
  if (!scenario || scenario.isActive === false) {
    throw new AppError('Supplier Scenario not found.', 404);
  }

  const deactivated = await scenarioRepository.update(id, { isActive: false });
  return toSupplierScenarioDto(deactivated);
}
