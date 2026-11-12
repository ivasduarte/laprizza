import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AggregateErrorCode,
  normalizeAggregate,
  validateAggregateShape,
  validateAggregateItems,
  validateAggregateOwner,
} from '../../src/domain/products/products.domain.js';
import { DomainError } from '../../src/domain/domain-error.js';

const OWNER = 'a00000000000000000000001';
const FLOUR = 'a00000000000000000000002';
const WATER = 'a00000000000000000000003';
const DOUGH = 'a00000000000000000000004';
const PIZZA = 'a00000000000000000000005';
const OLD = 'a00000000000000000000006';

const produced = (items) => ({ classification: 'PRODUCED', items });
const item = (productId, quantity = 1) => ({ productId, quantity });

/** Asserts that `fn` throws a DomainError with the given code. */
const throwsCode = (fn, code) =>
  assert.throws(fn, (err) => err instanceof DomainError && err.code === code);

// normalizeAggregate

test('normalizeAggregate keeps null/undefined as "not an aggregate"', () => {
  assert.equal(normalizeAggregate(null), null);
  assert.equal(normalizeAggregate(undefined), null);
});

test('normalizeAggregate turns missing items into an empty list', () => {
  assert.deepEqual(normalizeAggregate({ classification: 'PURCHASED' }), {
    classification: 'PURCHASED',
    items: [],
  });
});

test('normalizeAggregate turns ids (or populated documents) into strings', () => {
  const normalized = normalizeAggregate({
    classification: 'PRODUCED',
    items: [
      { productId: { _id: FLOUR }, quantity: 2 },
      { productId: WATER, quantity: 1 },
    ],
  });
  assert.deepEqual(normalized, produced([item(FLOUR, 2), item(WATER, 1)]));
});

// validateAggregateShape

test('validateAggregateShape accepts a produced aggregate with items', () => {
  validateAggregateShape(OWNER, produced([item(FLOUR, 2), item(WATER)]));
});

test('validateAggregateShape accepts a purchased aggregate without composition', () => {
  validateAggregateShape(OWNER, { classification: 'PURCHASED', items: [] });
});

test('validateAggregateShape rejects an unknown classification', () => {
  throwsCode(
    () => validateAggregateShape(OWNER, { classification: 'OTHER', items: [] }),
    AggregateErrorCode.INVALID_CLASSIFICATION,
  );
});

test('validateAggregateShape rejects items that are not a list', () => {
  throwsCode(
    () => validateAggregateShape(OWNER, { classification: 'PRODUCED', items: 'x' }),
    AggregateErrorCode.INVALID_ITEMS,
  );
});

test('validateAggregateShape rejects a purchased aggregate with items', () => {
  throwsCode(
    () => validateAggregateShape(OWNER, { classification: 'PURCHASED', items: [item(FLOUR)] }),
    AggregateErrorCode.PURCHASED_WITH_ITEMS,
  );
});

test('validateAggregateShape rejects a produced aggregate without items', () => {
  throwsCode(
    () => validateAggregateShape(OWNER, produced([])),
    AggregateErrorCode.PRODUCED_WITHOUT_ITEMS,
  );
});

test('validateAggregateShape rejects quantities that are not integers >= 1', () => {
  for (const quantity of [0, -1, 1.5, '2', null, undefined]) {
    throwsCode(
      () => validateAggregateShape(OWNER, produced([{ productId: FLOUR, quantity }])),
      AggregateErrorCode.INVALID_QUANTITY,
    );
  }
});

test('validateAggregateShape rejects the product as an item of itself', () => {
  throwsCode(
    () => validateAggregateShape(OWNER, produced([item(OWNER)])),
    AggregateErrorCode.SELF_REFERENCE,
  );
});

test('validateAggregateShape skips the self reference check when creating (no id yet)', () => {
  validateAggregateShape(null, produced([item(FLOUR)]));
});

test('validateAggregateShape rejects repeated items', () => {
  throwsCode(
    () => validateAggregateShape(OWNER, produced([item(FLOUR, 1), item(FLOUR, 2)])),
    AggregateErrorCode.DUPLICATE_ITEM,
  );
});

// validateAggregateItems

const infos = [
  { id: FLOUR, name: 'Flour', isActive: true, isAggregate: false },
  { id: WATER, name: 'Water', isActive: true, isAggregate: false },
  { id: DOUGH, name: 'Dough', isActive: true, isAggregate: true },
  { id: PIZZA, name: 'Margherita', isActive: true, isAggregate: false },
  { id: OLD, name: 'Old', isActive: false, isAggregate: false },
];

test('validateAggregateItems accepts existing, active, simple products', () => {
  validateAggregateItems([item(FLOUR), item(WATER)], infos, [PIZZA]);
});

test('validateAggregateItems rejects unknown items', () => {
  throwsCode(
    () => validateAggregateItems([item('a00000000000000000000999')], infos, []),
    AggregateErrorCode.ITEM_NOT_FOUND,
  );
});

test('validateAggregateItems rejects inactive items', () => {
  throwsCode(
    () => validateAggregateItems([item(OLD)], infos, []),
    AggregateErrorCode.ITEM_INACTIVE,
  );
});

test('validateAggregateItems rejects pizzas as items', () => {
  throwsCode(
    () => validateAggregateItems([item(PIZZA)], infos, [PIZZA]),
    AggregateErrorCode.ITEM_IS_PIZZA,
  );
});

test('validateAggregateItems rejects an aggregate inside another aggregate', () => {
  throwsCode(() => validateAggregateItems([item(DOUGH)], infos, []), AggregateErrorCode.NESTED);
});

// validateAggregateOwner

test('validateAggregateOwner accepts a product that is neither a pizza nor an item', () => {
  validateAggregateOwner({ isPizza: false, isItemOfAggregate: false });
});

test('validateAggregateOwner rejects a pizza', () => {
  throwsCode(
    () => validateAggregateOwner({ isPizza: true, isItemOfAggregate: false }),
    AggregateErrorCode.OWNER_IS_PIZZA,
  );
});

test('validateAggregateOwner rejects an item of another aggregate (no nesting)', () => {
  throwsCode(
    () => validateAggregateOwner({ isPizza: false, isItemOfAggregate: true }),
    AggregateErrorCode.OWNER_IS_ITEM,
  );
});

test('DomainError keeps the code and stays compatible without it', () => {
  assert.equal(new DomainError('x', 'SOME_CODE').code, 'SOME_CODE');
  assert.equal(new DomainError('x').code, null);
});
