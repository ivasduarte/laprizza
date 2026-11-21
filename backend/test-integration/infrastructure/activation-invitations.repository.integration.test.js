import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import ActivationInvitation from '../../src/infrastructure/auth/activation-invitation.model.js';
import * as invitationsRepository from '../../src/infrastructure/auth/activation-invitations.repository.js';
import { startMongo, STARTUP_TIMEOUT_MS } from '../support/mongo-container.js';

/**
 * AA06: activation invitations against a real MongoDB (Testcontainers): unique token hash,
 * replacement and single use.
 */
let mongo;

before(
  async () => {
    mongo = await startMongo();
  },
  { timeout: STARTUP_TIMEOUT_MS },
);

after(async () => {
  await mongo?.stop();
});

beforeEach(async () => {
  await ActivationInvitation.deleteMany({});
});

const NOW = new Date('2026-11-20T10:00:00Z');
const USER_ID = new mongoose.Types.ObjectId();
const invitation = (overrides = {}) =>
  invitationsRepository.create({
    tokenHash: 'hash-1',
    userId: USER_ID,
    email: 'new@laprizza.pt',
    issuedBy: { kind: 'SYSTEM', process: 'external-first-login' },
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 3_600_000),
    ...overrides,
  });

test('the token hash is unique', async () => {
  await invitation();
  await assert.rejects(invitation(), (err) => err.code === 11000);
});

test('an invitation can be used once', async () => {
  await invitation();
  const used = await invitationsRepository.consume('hash-1', NOW);
  assert.deepEqual(used.usedAt, NOW);
  assert.equal(await invitationsRepository.consume('hash-1', NOW), null);
});

test('a replaced or expired invitation is unusable', async () => {
  await invitation();
  await invitation({ tokenHash: 'hash-2', expiresAt: new Date(NOW.getTime() - 1) });
  await invitationsRepository.revokePendingForUser(USER_ID, NOW);

  assert.equal(await invitationsRepository.consume('hash-1', NOW), null);
  assert.equal(await invitationsRepository.consume('hash-2', NOW), null);
});

test('AA07: findByTokenHash reads an invitation without using it', async () => {
  await invitation();
  const found = await invitationsRepository.findByTokenHash('hash-1');
  assert.equal(found.email, 'new@laprizza.pt');
  assert.equal(found.usedAt, null);
  assert.ok(found.expiresAt instanceof Date);
  assert.equal(await invitationsRepository.findByTokenHash('unknown'), null);
  // Still usable after the read.
  assert.ok(await invitationsRepository.consume('hash-1', NOW));
});
