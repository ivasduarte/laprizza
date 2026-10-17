import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_PIZZA_COMPONENT_TYPES,
    normalizeName,
    validateName,
    validateAssemblyOrder,
    validateMinQuantity,
    normalizeMaxQuantity,
    validateMaxQuantity,
    validateQuantityRange,
} from '../../src/domain/pizza-component-types.domain.js';

test('normalizeName trims and collapses whitespaces', () => {
  assert.equal(normalizeName('  Base  Dough '), 'Base Dough');
  assert.equal(normalizeName('Cheese'), 'Cheese');
  assert.equal(normalizeName('Base\t\nSauce'), 'Base Sauce');
});

test('normalizeName returns non-string values unchanged', () => {
  assert.equal(normalizeName(undefined), undefined);
  assert.equal(normalizeName(null), null);
  assert.equal(normalizeName(123), 123);
});

test('validateName rejects missing, blank and non-string names', () => {
  assert.throws(() => validateName(''), /Invalid Name/);
  assert.throws(() => validateName('  '), /Invalid Name/);
  assert.throws(() => validateName(undefined), /Invalid Name/);
  assert.throws(() => validateName(null), /Invalid Name/);
  assert.throws(() => validateName(123), /Invalid Name/);
});
 
test('validateName accepts non-blank names', () => {
  assert.doesNotThrow(() => validateName('Cheese'));
  assert.doesNotThrow(() => validateName('Base Dough'));
  assert.doesNotThrow(() => validateName('a'.repeat(500)));
});

test('validateAssemblyOrder rejects values that are not integers greater than or equal to 1', () => {
  for (const value of [0, -1, 1.5, '1', null, undefined, NaN, Infinity]) {
    assert.throws(() => validateAssemblyOrder(value), /Invalid Assembly Order/, String(value));
  }
});
 
test('validateAssemblyOrder accepts integers greater than or equal to 1', () => {
  assert.doesNotThrow(() => validateAssemblyOrder(1));
  assert.doesNotThrow(() => validateAssemblyOrder(4));
  assert.doesNotThrow(() => validateAssemblyOrder(100));
});

test('validateMinQuantity rejects values that are not non-negative integers', () => {
  for (const value of [-1, 1.5, '0', null, undefined, NaN, Infinity]) {
    assert.throws(() => validateMinQuantity(value), /Invalid Minimum Quantity/, String(value));
  }
});
 
test('validateMinQuantity accepts zero and positive integers', () => {
  assert.doesNotThrow(() => validateMinQuantity(0));
  assert.doesNotThrow(() => validateMinQuantity(1));
  assert.doesNotThrow(() => validateMinQuantity(10));
});

test('normalizeMaxQuantity turns an omitted maximum into null (unbounded)', () => {
  assert.equal(normalizeMaxQuantity(undefined), null);
});
 
test('normalizeMaxQuantity keeps null and any other value unchanged', () => {
  assert.equal(normalizeMaxQuantity(null), null);
  assert.equal(normalizeMaxQuantity(1), 1);
  assert.equal(normalizeMaxQuantity(0), 0);
  assert.equal(normalizeMaxQuantity('a'), 'a');
});

test('validateMaxQuantity rejects zero, negatives, decimals and non-numbers', () => {
  for (const value of [0, -1, 1.5, '1', undefined, NaN, Infinity]) {
    assert.throws(() => validateMaxQuantity(value), /Invalid Maximum Quantity/, String(value));
  }
});
 
test('validateMaxQuantity accepts null (unbounded) and integers greater than or equal to 1', () => {
  assert.doesNotThrow(() => validateMaxQuantity(null));
  assert.doesNotThrow(() => validateMaxQuantity(1));
  assert.doesNotThrow(() => validateMaxQuantity(10));
});

test('validateQuantityRange rejects a maximum lower than the minimum', () => {
  assert.throws(() => validateQuantityRange(2, 1), /Invalid Range/);
  assert.throws(() => validateQuantityRange(5, 3), /Invalid Range/);
});
 
test('validateQuantityRange accepts equal values and a maximum greater than the minimum', () => {
  assert.doesNotThrow(() => validateQuantityRange(1, 1));
  assert.doesNotThrow(() => validateQuantityRange(0, 1));
  assert.doesNotThrow(() => validateQuantityRange(1, 5));
});
 
test('validateQuantityRange accepts any minimum when the maximum is unbounded (null)', () => {
  assert.doesNotThrow(() => validateQuantityRange(0, null));
  assert.doesNotThrow(() => validateQuantityRange(100, null));
});

test('default pizza component types match the ones required by the US (BCK07)', () => {
  assert.deepEqual(DEFAULT_PIZZA_COMPONENT_TYPES, [
    { name: 'Base Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 },
    { name: 'Base Sauce', assemblyOrder: 2, minQuantity: 0, maxQuantity: 1 },
    { name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 },
    { name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null },
  ]);
});
 
test('default pizza component types have unique names and assembly orders', () => {
  const names = DEFAULT_PIZZA_COMPONENT_TYPES.map((t) => normalizeName(t.name).toLowerCase());
  const orders = DEFAULT_PIZZA_COMPONENT_TYPES.map((t) => t.assemblyOrder);
 
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(orders).size, orders.length);
});
 
test('default pizza component types respect every domain rule', () => {
  for (const type of DEFAULT_PIZZA_COMPONENT_TYPES) {
    assert.doesNotThrow(() => {
      validateName(normalizeName(type.name));
      validateAssemblyOrder(type.assemblyOrder);
      validateMinQuantity(type.minQuantity);
      validateMaxQuantity(normalizeMaxQuantity(type.maxQuantity));
      validateQuantityRange(type.minQuantity, normalizeMaxQuantity(type.maxQuantity));
    }, type.name);
  }
});
 
test('default pizza component types cannot be modified', () => {
  assert.ok(Object.isFrozen(DEFAULT_PIZZA_COMPONENT_TYPES));
  assert.ok(DEFAULT_PIZZA_COMPONENT_TYPES.every((type) => Object.isFrozen(type)));
});