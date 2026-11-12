import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ScenarioErrorCode,
  validateScenario,
  validateScenarioCode,
  validateScenarioName,
  validateScenarioVersion,
  validateScenarioOrders,
  validateScenarioStock,
} from '../../src/domain/ai-scenario/ai-scenario.domain.js';
import { DomainError } from '../../src/domain/domain-error.js';

const PIZZA = 'b00000000000000000000001';
const SIZE_M = 'b00000000000000000000002';
const SIZE_L = 'b00000000000000000000003';
const CHEESE = 'b00000000000000000000004';
const OREGANO = 'b00000000000000000000005';

const pizzas = [{ productId: PIZZA, sizeIds: [SIZE_M] }];
const stockProducts = [
  { id: CHEESE, stockControlled: true },
  { id: OREGANO, stockControlled: false },
];
const order = (overrides = {}) => ({ pizzaId: PIZZA, sizeId: SIZE_M, quantity: 2, ...overrides });

const VALID = {
  code: 'DEMO-PARTIAL',
  name: '[Demo] Partial',
  version: 1,
  simulated: true,
  orders: [order()],
  stock: [{ productId: CHEESE, quantity: 0 }],
};

const throwsCode = (fn, code) =>
  assert.throws(fn, (err) => err instanceof DomainError && err.code === code);

test('validateScenario accepts a valid scenario, with or without stock', () => {
  validateScenario(VALID, { pizzas, stockProducts });
  validateScenario({ ...VALID, stock: null }, { pizzas, stockProducts });
  validateScenario({ ...VALID, stock: undefined }, { pizzas, stockProducts });
});

test('validateScenarioCode accepts uppercase letters, digits and hyphens up to 64 chars', () => {
  assert.equal(validateScenarioCode('DEMO-1'), 'DEMO-1');
  assert.equal(validateScenarioCode('A'.repeat(64)), 'A'.repeat(64));
});

test('validateScenarioCode rejects other formats', () => {
  for (const code of ['', 'demo', 'DEMO 1', 'DEMO_1', 'A'.repeat(65), null, 12]) {
    throwsCode(() => validateScenarioCode(code), ScenarioErrorCode.INVALID_CODE);
  }
});

test('validateScenarioName requires a non-blank name and trims it', () => {
  assert.equal(validateScenarioName('  Demo  '), 'Demo');
  for (const name of ['', '   ', null, undefined]) {
    throwsCode(() => validateScenarioName(name), ScenarioErrorCode.INVALID_NAME);
  }
});

test('validateScenarioVersion requires an integer >= 1', () => {
  assert.equal(validateScenarioVersion(3), 3);
  for (const version of [0, -1, 1.5, '1', null]) {
    throwsCode(() => validateScenarioVersion(version), ScenarioErrorCode.INVALID_VERSION);
  }
});

test('validateScenario rejects a scenario that is not a simulation', () => {
  throwsCode(
    () => validateScenario({ ...VALID, simulated: false }, { pizzas, stockProducts }),
    ScenarioErrorCode.NOT_SIMULATED,
  );
});

test('validateScenarioOrders requires at least one line', () => {
  for (const orders of [[], null, undefined]) {
    throwsCode(() => validateScenarioOrders(orders, pizzas), ScenarioErrorCode.EMPTY_ORDERS);
  }
});

test('validateScenarioOrders rejects quantities that are not integers >= 1', () => {
  for (const quantity of [0, -1, 1.5, '2']) {
    throwsCode(
      () => validateScenarioOrders([order({ quantity })], pizzas),
      ScenarioErrorCode.INVALID_QUANTITY,
    );
  }
});

test('validateScenarioOrders rejects products that are not predefined pizzas', () => {
  throwsCode(
    () => validateScenarioOrders([order({ pizzaId: CHEESE })], pizzas),
    ScenarioErrorCode.PIZZA_NOT_PREDEFINED,
  );
});

test('validateScenarioOrders rejects sizes not allowed for the pizza', () => {
  throwsCode(
    () => validateScenarioOrders([order({ sizeId: SIZE_L })], pizzas),
    ScenarioErrorCode.SIZE_NOT_ALLOWED,
  );
});

test('validateScenarioOrders rejects the same pizza and size twice', () => {
  throwsCode(
    () => validateScenarioOrders([order(), order({ quantity: 5 })], pizzas),
    ScenarioErrorCode.DUPLICATE_ORDER,
  );
});

test('validateScenarioStock accepts null (no stock of its own)', () => {
  validateScenarioStock(null, stockProducts);
});

test('validateScenarioStock rejects a value that is not a list', () => {
  throwsCode(() => validateScenarioStock('x', stockProducts), ScenarioErrorCode.INVALID_STOCK);
});

test('validateScenarioStock rejects quantities that are not integers >= 0', () => {
  for (const quantity of [-1, 1.5, '3', null]) {
    throwsCode(
      () => validateScenarioStock([{ productId: CHEESE, quantity }], stockProducts),
      ScenarioErrorCode.INVALID_QUANTITY,
    );
  }
});

test('validateScenarioStock rejects unknown products', () => {
  throwsCode(
    () =>
      validateScenarioStock(
        [{ productId: 'b00000000000000000000999', quantity: 1 }],
        stockProducts,
      ),
    ScenarioErrorCode.STOCK_UNKNOWN_PRODUCT,
  );
});

test('validateScenarioStock rejects products without stock control', () => {
  throwsCode(
    () => validateScenarioStock([{ productId: OREGANO, quantity: 1 }], stockProducts),
    ScenarioErrorCode.STOCK_NOT_CONTROLLED,
  );
});

test('validateScenarioStock rejects the same product twice', () => {
  throwsCode(
    () =>
      validateScenarioStock(
        [
          { productId: CHEESE, quantity: 1 },
          { productId: CHEESE, quantity: 2 },
        ],
        stockProducts,
      ),
    ScenarioErrorCode.DUPLICATE_STOCK,
  );
});
