import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSizeIds,
  validateComponentIds,
  validatePizzaProduct,
  validateSizes,
  validateComponents,
  validateSizeAvailability,
  validatePredefinedPizza,
  createPredefinedPizzaData,
} from '../../src/domain/predefined-pizza.domain.js';
import { DomainError } from '../../src/domain/domain-error.js';

const isDomainError = (err) => err instanceof DomainError;

const sizes = [
  { id: 's1', name: 'Small', isActive: true },
  { id: 's2', name: 'Large', isActive: true },
  { id: 's3', name: 'Family', isActive: false },
];

const types = [
  { id: 't1', name: 'Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 },
  { id: 't2', name: 'Sauce', assemblyOrder: 2, minQuantity: 1, maxQuantity: 1 },
  { id: 't3', name: 'Cheese', assemblyOrder: 3, minQuantity: 1, maxQuantity: null },
];

const comp = (id, name, componentTypeId, configuredSizeIds = ['s1', 's2'], isActive = true) => ({
  id, name, isActive, componentTypeId, configuredSizeIds,
});

const dough = comp('c1', 'Dough', 't1');
const sauce = comp('c2', 'Sauce', 't2');
const cheese = comp('c3', 'Mozzarella', 't3');
const cheese2 = comp('c4', 'Cheddar', 't3');

test('validateSizeIds and validateComponentIds accept valid lists and normalize ids to strings', () => {
  assert.deepEqual(validateSizeIds(['s1', 's2']), ['s1', 's2']);
  assert.deepEqual(validateComponentIds([1, 2]), ['1', '2']);
});

test('validateSizeIds and validateComponentIds reject null, non arrays, empty and repeated lists', () => {
  const invalidInputs = [null, undefined, 'abc', {}, [], ['a', 'a']];

  for (const input of invalidInputs) {
    assert.throws(() => validateSizeIds(input), isDomainError);
    assert.throws(() => validateComponentIds(input), isDomainError);
  }
});

test('validatePizzaProduct requires an active, sellable product that is not a Pizza Component', () => {
  const valid = { id: 'p', name: 'Margherita', isActive: true, sellable: true, componentTypeId: null };
  assert.equal(validatePizzaProduct(valid), valid);

  assert.throws(() => validatePizzaProduct(null), isDomainError);
  assert.throws(() => validatePizzaProduct({ ...valid, isActive: false }), isDomainError);
  assert.throws(() => validatePizzaProduct({ ...valid, sellable: false }), isDomainError);
  assert.throws(() => validatePizzaProduct({ ...valid, componentTypeId: 't1' }), isDomainError);
});

test('validateSizes rejects unknown and inactive sizes', () => {
  assert.deepEqual(validateSizes(['s1', 's2'], sizes), ['s1', 's2']);
  assert.throws(() => validateSizes(['s1', 'nope'], sizes), (err) => isDomainError(err) && err.message.includes('not found'));
  assert.throws(() => validateSizes(['s3'], sizes), (err) => isDomainError(err) && err.message.includes('active'));
});

test('validateComponents accepts a configuration that respects every cardinality rule', () => {
  const components = [dough, sauce, cheese];
  assert.deepEqual(validateComponents(['c1', 'c2', 'c3'], components, types), ['c1', 'c2', 'c3']);
});

test('validateComponents treats maxQuantity null as unbounded', () => {
  const components = [dough, sauce, cheese, cheese2];
  assert.doesNotThrow(() => validateComponents(['c1', 'c2', 'c3', 'c4'], components, types));
});

test('validateComponents rejects unknown, inactive and non component products', () => {
  const inactive = comp('c5', 'Old Cheese', 't3', ['s1', 's2'], false);
  const notComponent = comp('c6', 'Napkin', null);

  assert.throws(
    () => validateComponents(['c1', 'nope'], [dough], types),
    (err) => isDomainError(err) && err.message.includes('not found'),
  );
  assert.throws(
    () => validateComponents(['c1', 'c2', 'c5'], [dough, sauce, inactive], types),
    (err) => isDomainError(err) && err.message.includes('active'),
  );
  assert.throws(
    () => validateComponents(['c1', 'c6'], [dough, notComponent], types),
    (err) => isDomainError(err) && err.message.includes('not designated'),
  );
});

test('validateComponents rejects configurations below minQuantity or above maxQuantity', () => {
  const dough2 = comp('c7', 'Whole Dough', 't1');

  assert.throws(
    () => validateComponents(['c1', 'c2'], [dough, sauce], types),
    (err) => isDomainError(err) && err.message.includes('at least 1') && err.message.includes('Cheese'),
  );
  assert.throws(
    () => validateComponents(['c1', 'c7', 'c2', 'c3'], [dough, dough2, sauce, cheese], types),
    (err) => isDomainError(err) && err.message.includes('at most 1') && err.message.includes('Dough'),
  );
});

test('validateSizeAvailability requires a Component Size Configuration for every component and size', () => {
  const small = sizes[0];
  const large = sizes[1];
  const cheeseSmallOnly = comp('c8', 'Gorgonzola', 't3', ['s1']);

  assert.doesNotThrow(() => validateSizeAvailability([dough, sauce, cheese], [small, large]));
  assert.doesNotThrow(() => validateSizeAvailability([dough, sauce, cheeseSmallOnly], [small]));
  assert.throws(
    () => validateSizeAvailability([dough, sauce, cheeseSmallOnly], [small, large]),
    (err) => isDomainError(err) && err.message.includes('Gorgonzola / Large'),
  );
});

test('validatePredefinedPizza runs all rules over the loaded entities', () => {
  const valid = {
    sizeIds: ['s1', 's2'],
    componentIds: ['c1', 'c2', 'c3'],
    sizes,
    components: [dough, sauce, cheese],
    componentTypes: types,
  };
  assert.doesNotThrow(() => validatePredefinedPizza(valid));

  assert.throws(() => validatePredefinedPizza({ ...valid, sizeIds: ['s3'] }), isDomainError);
  assert.throws(() => validatePredefinedPizza({ ...valid, componentIds: ['c1', 'c2'] }), isDomainError);
  assert.throws(
    () => validatePredefinedPizza({ ...valid, components: [dough, sauce, comp('c3', 'Mozzarella', 't3', ['s1'])] }),
    isDomainError,
  );
});

test('createPredefinedPizzaData returns the structured object', () => {
  assert.deepEqual(createPredefinedPizzaData(12, ['s1'], ['c1', 'c2']), {
    productId: '12',
    sizeIds: ['s1'],
    defaultConfiguration: { componentIds: ['c1', 'c2'] },
  });
});
