import test from 'node:test';
import assert from 'node:assert/strict';
import Joi from 'joi';
import { joiDetails } from '../../src/api/middleware/joi-details.js';

const schema = Joi.object({
  name: Joi.string().trim().min(3).required(),
  email: Joi.string().email().required().messages({ 'any.required': 'Mandatory field.' }),
  address: Joi.object({
    postalCode: Joi.string()
      .pattern(/^\d{4}-\d{3}$/)
      .required(),
  }).required(),
  tags: Joi.array().items(Joi.string().hex()).max(1),
  age: Joi.number().min(18),
});

function validate(payload) {
  const { error } = schema.validate(payload, { abortEarly: false });
  return joiDetails(error);
}

test('joiDetails maps every violation to { field, type, message }', () => {
  const details = validate({});
  assert.deepEqual(
    details.map((d) => [d.field, d.type]),
    [
      ['name', 'any.required'],
      ['email', 'any.required'],
      ['address', 'any.required'],
    ],
  );
  details.forEach((d) => assert.equal(typeof d.message, 'string'));
});

test('joiDetails keeps the stable type even when the message is customised', () => {
  const email = validate({ name: 'Ana', address: { postalCode: '4460-123' } }).find(
    (d) => d.field === 'email',
  );
  assert.equal(email.type, 'any.required');
  assert.equal(email.message, 'Mandatory field.');
});

test('joiDetails joins nested and array paths with dots', () => {
  const details = validate({
    name: 'Ana',
    email: 'a@b.pt',
    address: { postalCode: 'x' },
    tags: ['zz', 'zz'],
  });
  const fields = details.map((d) => d.field);
  assert.ok(fields.includes('address.postalCode'));
  assert.ok(fields.includes('tags.0'));
});

test('joiDetails exposes numeric limits only', () => {
  const details = validate({
    name: 'ab',
    email: 'a@b.pt',
    address: { postalCode: '4460-123' },
    age: 5,
  });
  assert.equal(details.find((d) => d.field === 'name').limit, 3);
  assert.equal(details.find((d) => d.field === 'age').limit, 18);
  assert.equal('limit' in validate({})[0], false);
});

test('joiDetails never echoes the submitted value, not even in pattern messages', () => {
  const secret = 'S3cret-VALUE-123';
  const details = validate({ name: 'Ana', email: secret, address: { postalCode: secret } });
  const pattern = details.find((d) => d.field === 'address.postalCode');
  assert.equal(pattern.type, 'string.pattern.base');
  assert.equal(JSON.stringify(details).includes(secret), false);
  details.forEach((d) =>
    assert.deepEqual(
      Object.keys(d).filter((k) => k === 'value' || k === 'context'),
      [],
    ),
  );
});
