import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, validateName } from '../../src/domain/product-categories/product-categories.domain.js';

test('normalizeName trims and collapses whitespaces', () => {
    assert.equal(normalizeName('  Soft  Drinks '), 'Soft Drinks');
    assert.equal(normalizeName('Pizzas'), 'Pizzas');
    assert.equal(normalizeName('Soft\t\nDrinks'), 'Soft Drinks');
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
    assert.doesNotThrow(() => validateName('Pizzas'));
    assert.doesNotThrow(() => validateName('Bebidas Alcoólicas'));
    assert.doesNotThrow(() => validateName('a'.repeat(500)));
});