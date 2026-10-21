import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../../src/domain/domain-error.js';
import {
  isPizzaComponent,
  findSizeConfiguration,
  validateProductIsPizzaComponent,
  normalizeStockUnitsConsumed,
  validatePizzaSizeId,
  validatePrice,
  validateStockUnitsConsumed,
} from '../../src/domain/component-size-configuration/component-size-configuration.domain.js';

const SIZE_A = '64b7f0c2a1b2c3d4e5f60001';
const SIZE_B = '64b7f0c2a1b2c3d4e5f60002';
const TYPE_ID = '64b7f0c2a1b2c3d4e5f60099';

test('isPizzaComponent is true when the product has a pizza component type', () => {
  assert.equal(isPizzaComponent({ pizzaComponentTypeId: TYPE_ID }), true);
});

test('isPizzaComponent is true when the pizza component type is a populated document', () => {
  assert.equal(isPizzaComponent({ pizzaComponentTypeId: { _id: TYPE_ID, name: 'Cheese' } }), true);
});

test('isPizzaComponent is false when the product has no pizza component type', () => {
  assert.equal(isPizzaComponent({ pizzaComponentTypeId: null }), false);
  assert.equal(isPizzaComponent({ pizzaComponentTypeId: undefined }), false);
  assert.equal(isPizzaComponent({}), false);
});

test('isPizzaComponent is false when there is no product', () => {
  assert.equal(isPizzaComponent(null), false);
  assert.equal(isPizzaComponent(undefined), false);
});

test('findSizeConfiguration returns the configuration of the given pizza size', () => {
  const product = {
    sizeConfigurations: [
      { pizzaSizeId: SIZE_A, price: 1, stockUnitsConsumed: 1 },
      { pizzaSizeId: SIZE_B, price: 2, stockUnitsConsumed: 2 },
    ],
  };

  assert.equal(findSizeConfiguration(product, SIZE_B), product.sizeConfigurations[1]);
  assert.equal(findSizeConfiguration(product, SIZE_A), product.sizeConfigurations[0]);
});

test('findSizeConfiguration compares ids as strings (ObjectId-like values)', () => {
  const objectId = { toString: () => SIZE_A };
  const product = { sizeConfigurations: [{ pizzaSizeId: objectId, price: 1 }] };

  assert.equal(findSizeConfiguration(product, SIZE_A), product.sizeConfigurations[0]);
  assert.equal(
    findSizeConfiguration(product, { toString: () => SIZE_A }),
    product.sizeConfigurations[0],
  );
});

test('findSizeConfiguration returns null when there is no configuration for the pizza size', () => {
  const product = { sizeConfigurations: [{ pizzaSizeId: SIZE_A, price: 1 }] };

  assert.equal(findSizeConfiguration(product, SIZE_B), null);
});

test('findSizeConfiguration returns null when the product has no configurations', () => {
  assert.equal(findSizeConfiguration({ sizeConfigurations: [] }, SIZE_A), null);
  assert.equal(findSizeConfiguration({}, SIZE_A), null);
  assert.equal(findSizeConfiguration(null, SIZE_A), null);
  assert.equal(findSizeConfiguration(undefined, SIZE_A), null);
});

test('validateProductIsPizzaComponent rejects products that are not pizza components', () => {
  assert.throws(
    () => validateProductIsPizzaComponent({ pizzaComponentTypeId: null }),
    /Invalid Component Size Configuration/,
  );
  assert.throws(() => validateProductIsPizzaComponent({}), /Invalid Component Size Configuration/);
  assert.throws(
    () => validateProductIsPizzaComponent(null),
    /Invalid Component Size Configuration/,
  );
});

test('validateProductIsPizzaComponent accepts pizza components', () => {
  assert.doesNotThrow(() => validateProductIsPizzaComponent({ pizzaComponentTypeId: TYPE_ID }));
});

test('normalizeStockUnitsConsumed turns an omitted value into null (not defined)', () => {
  assert.equal(normalizeStockUnitsConsumed(undefined), null);
});

test('normalizeStockUnitsConsumed keeps null and any other value unchanged', () => {
  assert.equal(normalizeStockUnitsConsumed(null), null);
  assert.equal(normalizeStockUnitsConsumed(1), 1);
  assert.equal(normalizeStockUnitsConsumed(0), 0);
  assert.equal(normalizeStockUnitsConsumed('a'), 'a');
});

test('validatePizzaSizeId rejects missing, blank and non-string values', () => {
  for (const value of [undefined, null, '', '   ', 123, {}, []]) {
    assert.throws(() => validatePizzaSizeId(value), /Invalid Pizza Size/, String(value));
  }
});

test('validatePizzaSizeId accepts non-blank strings', () => {
  assert.doesNotThrow(() => validatePizzaSizeId(SIZE_A));
  assert.doesNotThrow(() => validatePizzaSizeId('a'));
});

test('validatePrice rejects negatives, non-finite values and non-numbers', () => {
  for (const value of [-1, -0.01, NaN, Infinity, -Infinity, '1', '', null, undefined, true, {}]) {
    assert.throws(() => validatePrice(value), /Invalid Price/, String(value));
  }
});

test('validatePrice accepts zero, integers and decimals', () => {
  assert.doesNotThrow(() => validatePrice(0));
  assert.doesNotThrow(() => validatePrice(1));
  assert.doesNotThrow(() => validatePrice(2.5));
  assert.doesNotThrow(() => validatePrice(1000.99));
});

test('validateStockUnitsConsumed requires stock controlled products to define it', () => {
  assert.throws(() => validateStockUnitsConsumed(true, null), /Invalid Stock Units Consumed/);
  assert.throws(() => validateStockUnitsConsumed(true, undefined), /Invalid Stock Units Consumed/);
});

test('validateStockUnitsConsumed rejects stock units that are not integers greater than or equal to 1', () => {
  for (const value of [0, -1, 1.5, '1', NaN, Infinity, true]) {
    assert.throws(
      () => validateStockUnitsConsumed(true, value),
      /Invalid Stock Units Consumed/,
      String(value),
    );
  }
});

test('validateStockUnitsConsumed accepts integers greater than or equal to 1 for stock controlled products', () => {
  assert.doesNotThrow(() => validateStockUnitsConsumed(true, 1));
  assert.doesNotThrow(() => validateStockUnitsConsumed(true, 5));
  assert.doesNotThrow(() => validateStockUnitsConsumed(true, 100));
});

test('validateStockUnitsConsumed does not allow products without stock control to define it', () => {
  for (const value of [0, 1, 5, '1']) {
    assert.throws(
      () => validateStockUnitsConsumed(false, value),
      /Only stock controlled products can define it/,
      String(value),
    );
  }
});

test('validateStockUnitsConsumed accepts null for products without stock control', () => {
  assert.doesNotThrow(() => validateStockUnitsConsumed(false, null));
  assert.doesNotThrow(() => validateStockUnitsConsumed(undefined, null));
});

test('the domain rules throw DomainError', () => {
  const failures = [
    () => validateProductIsPizzaComponent({}),
    () => validatePizzaSizeId(''),
    () => validatePrice(-1),
    () => validateStockUnitsConsumed(true, null),
    () => validateStockUnitsConsumed(false, 1),
  ];

  for (const failure of failures) {
    assert.throws(failure, DomainError);
  }
});