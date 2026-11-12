import { DomainError } from '../domain-error.js';

export const SCENARIO_CODE_PATTERN = /^[A-Z0-9-]{1,64}$/;

export const ScenarioErrorCode = Object.freeze({
  INVALID_CODE: 'SCENARIO_INVALID_CODE',
  INVALID_NAME: 'SCENARIO_INVALID_NAME',
  INVALID_VERSION: 'SCENARIO_INVALID_VERSION',
  NOT_SIMULATED: 'SCENARIO_NOT_SIMULATED',
  EMPTY_ORDERS: 'SCENARIO_EMPTY_ORDERS',
  INVALID_QUANTITY: 'SCENARIO_INVALID_QUANTITY',
  PIZZA_NOT_PREDEFINED: 'SCENARIO_PIZZA_NOT_PREDEFINED',
  SIZE_NOT_ALLOWED: 'SCENARIO_SIZE_NOT_ALLOWED',
  DUPLICATE_ORDER: 'SCENARIO_DUPLICATE_ORDER',
  INVALID_STOCK: 'SCENARIO_INVALID_STOCK',
  STOCK_UNKNOWN_PRODUCT: 'SCENARIO_STOCK_UNKNOWN_PRODUCT',
  STOCK_NOT_CONTROLLED: 'SCENARIO_STOCK_NOT_CONTROLLED',
  DUPLICATE_STOCK: 'SCENARIO_DUPLICATE_STOCK',
});

const scenarioError = (message, code) => new DomainError(`Invalid AI Scenario: ${message}`, code);

export function validateScenarioCode(code) {
  if (typeof code !== 'string' || !SCENARIO_CODE_PATTERN.test(code)) {
    throw scenarioError(
      'Code must have 1 to 64 uppercase letters, digits or hyphens.',
      ScenarioErrorCode.INVALID_CODE,
    );
  }

  return code;
}

export function validateScenarioName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw scenarioError('Name is required', ScenarioErrorCode.INVALID_NAME);
  }
  return name.trim();
}

export function validateScenarioVersion(version) {
  if (!Number.isInteger(version) || version < 1) {
    throw scenarioError(
      'Version must be an integer greater than or equal to 1.',
      ScenarioErrorCode.INVALID_VERSION,
    );
  }
  return version;
}

/**
 * Validates the simulated orders.
 * - Not empty;
 * - Each line uses a predefined pizza and a size allowed for it;
 * - quantities >= 1;
 * - The same pizza and size cannot appear twice.
 * 
 * @param {*} orders 
 * @param {*} pizzas - Active predefined pizzas of the orders.
 * @throws {DomainError}
 */
export function validateScenarioOrders(orders, pizzas) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw scenarioError('At least one order line is required.', ScenarioErrorCode.EMPTY_ORDERS);
  }

  const sizesByPizza = new Map(pizzas.map((p) => [String(p.productId), p.sizeIds.map(String)]));
  const seen = new Set();

  for (const order of orders) {
    const pizzaId = String(order.pizzaId);
    const sizeId = String(order.sizeId);

    if (!Number.isInteger(order.quantity) || order.quantity < 1) {
      throw scenarioError(
        'Order quantity must be an integer greater than or equal to 1.',
        ScenarioErrorCode.INVALID_QUANTITY,
      );
    }
    if (!sizesByPizza.has(pizzaId)) {
      throw scenarioError(
        `Pizza is not an active predefined pizza: ${pizzaId}.`,
        ScenarioErrorCode.PIZZA_NOT_PREDEFINED,
      );
    }
    if (!sizesByPizza.get(pizzaId).includes(sizeId)) {
      throw scenarioError(
        `Size ${sizeId} is not allowed for pizza ${pizzaId}.`,
        ScenarioErrorCode.SIZE_NOT_ALLOWED,
      );
    }
    const key = `${pizzaId}/${sizeId}`;
    if (seen.has(key)) {
      throw scenarioError(
        `The same pizza and size cannot appear twice: ${key}.`,
        ScenarioErrorCode.DUPLICATE_ORDER,
      );
    }
    seen.add(key);
  }
}

/**
 * Validates the simulated stock (null means the scenario has no stock of its own).
 * Only stock controlled products, each at most once, with integer quantities >= 0.
 * 
 * @param {*} stock 
 * @param {*} products - Products referenced by the stock.
 * @throws {DomainError} 
 */
export function validateScenarioStock(stock, products) {
  if (stock === null || stock === undefined) return;
  if (!Array.isArray(stock)) {
    throw scenarioError('Stock must be a list or null.', ScenarioErrorCode.INVALID_STOCK);
  }

  const byId = new Map(products.map((p) => [String(p.id), p]));
  const seen = new Set();

  for (const entry of stock) {
    const productId = String(entry.productId);

    if (!Number.isInteger(entry.quantity) || entry.quantity < 0) {
      throw scenarioError(
        'Stock quantity must be a non-negative integer.',
        ScenarioErrorCode.INVALID_QUANTITY,
      );
    }
    const product = byId.get(productId);
    if (!product) {
      throw scenarioError(
        `Stock refers to an unknown product: ${productId}.`,
        ScenarioErrorCode.STOCK_UNKNOWN_PRODUCT,
      );
    }
    if (!product.stockControlled) {
      throw scenarioError(
        `Stock is only allowed for stock controlled products: ${productId}.`,
        ScenarioErrorCode.STOCK_NOT_CONTROLLED,
      );
    }
    if (seen.has(productId)) {
      throw scenarioError(
        `The same product cannot appear twice in the stock: ${productId}.`,
        ScenarioErrorCode.DUPLICATE_STOCK,
      );
    }
    seen.add(productId);
  }
}

export function validateScenario(scenario, { pizzas, stockProducts }) {
  validateScenarioCode(scenario.code);
  validateScenarioName(scenario.name);
  validateScenarioVersion(scenario.version);

  if (scenario.simulated !== true) {
    throw scenarioError('A scenario is always a simulation', ScenarioErrorCode.NOT_SIMULATED);
  }

  validateScenarioOrders(scenario.orders, pizzas);
  validateScenarioStock(scenario.stock ?? null, stockProducts);
}