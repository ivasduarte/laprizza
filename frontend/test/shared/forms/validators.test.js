import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  email,
  hasErrors,
  integer,
  maxLength,
  maxValue,
  minLength,
  minValue,
  passwordRules,
  pattern,
  required,
  sameAs,
  toFieldMap,
  validateField,
  validateForm,
} from '../../../src/shared/forms/validators.js';
import {
  fieldProps,
  makeIdFor,
} from '../../../src/shared/forms/field-props.js';

describe('validation rules (same descriptors as the API details)', () => {
  it('required rejects empty, blank, null and undefined', () => {
    ['', '   ', null, undefined].forEach((value) =>
      assert.deepEqual(required()(value), { type: 'any.required' })
    );
    assert.equal(required()('x'), null);
    assert.equal(required()(0), null);
  });

  it('length rules carry their limit and ignore empty values', () => {
    assert.deepEqual(minLength(3)('ab'), { type: 'string.min', limit: 3 });
    assert.equal(minLength(3)('abc'), null);
    assert.equal(minLength(3)(''), null); // required() reports emptiness
    assert.deepEqual(maxLength(3)('abcd'), { type: 'string.max', limit: 3 });
    assert.equal(maxLength(3)('abc'), null);
  });

  it('email', () => {
    assert.equal(email()('a@b.pt'), null);
    ['a', 'a@b', '@b.pt', 'a b@c.pt'].forEach((value) =>
      assert.deepEqual(email()(value), { type: 'string.email' })
    );
  });

  it('number rules', () => {
    assert.deepEqual(integer()('1.5'), { type: 'number.integer' });
    assert.equal(integer()('2'), null);
    assert.deepEqual(minValue(1)('0'), { type: 'number.min', limit: 1 });
    assert.deepEqual(maxValue(5)(6), { type: 'number.max', limit: 5 });
  });

  it('pattern accepts a custom type; sameAs compares with another field', () => {
    assert.deepEqual(pattern(/\d/, 'custom.digit')('abc'), {
      type: 'custom.digit',
    });
    assert.deepEqual(sameAs('a')('x', { a: 'y' }), { type: 'custom.mismatch' });
    assert.equal(sameAs('a')('x', { a: 'x' }), null);
  });

  it('validateField returns the first violation only', () => {
    assert.deepEqual(validateField('', [required(), minLength(3)]), {
      type: 'any.required',
    });
    assert.deepEqual(validateField('ab', [required(), minLength(3)]), {
      type: 'string.min',
      limit: 3,
    });
    assert.equal(validateField('abc', [required(), minLength(3)]), null);
  });

  it('validateForm maps field -> violation and is empty when valid', () => {
    const schema = { name: [required()], email: [required(), email()] };
    const errors = validateForm({ name: '', email: 'bad' }, schema);
    assert.deepEqual(errors, {
      name: { type: 'any.required' },
      email: { type: 'string.email' },
    });
    assert.equal(hasErrors(errors), true);
    assert.equal(
      hasErrors(validateForm({ name: 'A', email: 'a@b.pt' }, schema)),
      false
    );
  });
});

describe('password policy mirrors the back end (8-64, uppercase, symbol)', () => {
  const run = (password) => validateField(password, passwordRules());
  it('accepts a valid password', () =>
    assert.equal(run('StrongPassword123!'), null));
  it('rejects each missing requirement', () => {
    assert.equal(run('').type, 'any.required');
    assert.deepEqual(run('Ab!'), { type: 'string.min', limit: 8 });
    assert.deepEqual(run(`A!${'a'.repeat(63)}`), {
      type: 'string.max',
      limit: 64,
    });
    assert.equal(run('lowercase!!').type, 'password.uppercase');
    assert.equal(run('NoSymbolsHere1').type, 'password.symbol');
  });
});

describe('API errors and accessibility attributes', () => {
  it('toFieldMap keeps the first error of each field', () => {
    assert.deepEqual(
      toFieldMap([
        { field: 'name', type: 'string.min', limit: 3 },
        { field: 'name', type: 'any.required' },
        { field: 'email', type: 'string.email' },
      ]),
      {
        name: { type: 'string.min', limit: 3 },
        email: { type: 'string.email' },
      }
    );
  });

  it('fieldProps binds an invalid input to its error text', () => {
    const idFor = makeIdFor('customer');
    assert.deepEqual(
      fieldProps(
        'address.postalCode',
        { 'address.postalCode': { type: 'x' } },
        idFor
      ),
      {
        id: 'customer-address-postalCode',
        'aria-invalid': 'true',
        'aria-describedby': 'customer-address-postalCode-error',
      }
    );
    assert.deepEqual(fieldProps('name', {}, idFor), {
      id: 'customer-name',
      'aria-invalid': undefined,
      'aria-describedby': undefined,
    });
  });
});
