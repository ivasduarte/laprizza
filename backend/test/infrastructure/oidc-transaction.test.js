import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransactionCodec } from '../../src/infrastructure/oidc/oidc-transaction.js';

const make = (over = {}) => {
  let now = new Date('2026-11-18T10:00:00Z');
  const codec = createTransactionCodec({ secret: 's3cret', ttlMs: 600_000, clock: { now: () => now }, ...over });
  return { codec, advance: (ms) => (now = new Date(now.getTime() + ms)) };
};
const PAYLOAD = { provider: 'google', state: 'st', nonce: 'no', codeVerifier: 'cv' };

test('sign/verify round trip returns the payload', () => {
  const { codec } = make();
  const out = codec.verify(codec.sign(PAYLOAD));
  assert.equal(out.state, 'st');
  assert.equal(out.codeVerifier, 'cv');
});

test('expired transaction is rejected', () => {
  const { codec, advance } = make();
  const value = codec.sign(PAYLOAD);
  advance(600_001);
  assert.equal(codec.verify(value), null);
});

test('tampered, foreign-secret, malformed and missing values are rejected', () => {
  const { codec } = make();
  const value = codec.sign(PAYLOAD);
  const [body, sig] = value.split('.');
  const forged = Buffer.from(JSON.stringify({ ...PAYLOAD, state: 'evil', exp: 9e15 })).toString('base64url');
  assert.equal(codec.verify(`${forged}.${sig}`), null);
  assert.equal(codec.verify(`${body}.AAAA`), null);
  assert.equal(codec.verify('garbage'), null);
  assert.equal(codec.verify(undefined), null);
  assert.equal(make({ secret: 'other' }).codec.verify(value), null);
});
