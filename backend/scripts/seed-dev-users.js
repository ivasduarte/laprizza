/**
 * Development users (AA05): one account per base role, one with two roles and one without roles,
 * all with the password in SEED_DEV_PASSWORD, so the permission matrix can be tried by hand.
 *
 *   npm run seed:dev-users -- --confirm
 *
 * - Refuses NODE_ENV=production, and remote databases unless --allow-remote is given.
 * - Idempotent: upsert by email (users) and by fixed _id (the customer record).
 * - Running it again resets password, roles and status, and ends the open sessions of these users.
 */
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { connectDB } from '../src/infrastructure/database.js';
import Users from '../src/infrastructure/users/users.model.js';
import Customers from '../src/infrastructure/customers/customers.model.js';
import { passwordHasher } from '../src/infrastructure/security/password-hasher.js';
import {
  Roles,
  AccountStatus,
  validatePasswordStrength,
} from '../src/domain/users/users.domain.js';

export class SeedError extends Error {}

/** Customer record linked to the CUSTOMER development account. */
export const DEV_CUSTOMER = Object.freeze({
  _id: 'c0c0c00000000000000000d1',
  name: 'Cliente Desenvolvimento',
  email: 'customer@laprizza.dev',
  phoneNumber: '900000001',
  address: {
    street: 'Rua de Teste',
    houseNumber: '1',
    postalCode: '4200-001',
    city: 'Porto',
    district: 'Porto',
  },
  dietaryRestrictions: [],
  isActive: true,
});

/** One account per base role, a multi-role account and an account without roles. */
export const DEV_USERS = Object.freeze([
  { email: 'manager@laprizza.dev', roles: [Roles.MANAGER] },
  { email: 'employee@laprizza.dev', roles: [Roles.EMPLOYEE] },
  { email: 'customer@laprizza.dev', roles: [Roles.CUSTOMER], customerId: DEV_CUSTOMER._id },
  { email: 'manager.employee@laprizza.dev', roles: [Roles.MANAGER, Roles.EMPLOYEE] },
  { email: 'noroles@laprizza.dev', roles: [] },
]);

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|mongo)(:\d+)?$/i;

/** Hosts of a MongoDB URI, without credentials. */
const hostsOf = (uri) =>
  String(uri)
    .replace(/^mongodb(\+srv)?:\/\//, '')
    .replace(/^[^@/]*@/, '')
    .split(/[/?]/)[0]
    .split(',');

/** Target of the seed for the console: hosts and database, never credentials or options. */
export function describeTarget(uri) {
  const database = String(uri).split('?')[0].split('/')[3] ?? '';
  return `${hostsOf(uri).join(',')}/${database}`;
}

/**
 * Checks everything before connecting.
 * @returns {{confirmed: boolean}} confirmed is false for a dry run (no --confirm).
 * @throws {SeedError}
 */
export function checkPreconditions({ nodeEnv, argv = [], uri, password }) {
  if (nodeEnv === 'production') {
    throw new SeedError(
      'Recusado: NODE_ENV=production. Estes utilizadores nunca podem existir em produção.',
    );
  }
  if (!uri) throw new SeedError('MONGODB_URI não está definido.');

  const remote = !hostsOf(uri).every((host) => LOCAL_HOST.test(host));
  if (remote && !argv.includes('--allow-remote')) {
    throw new SeedError(
      `Recusado: ${describeTarget(uri)} não é uma base de dados local. ` +
        'Usa --allow-remote só numa base de dados de desenvolvimento que seja tua.',
    );
  }

  if (!password) throw new SeedError('SEED_DEV_PASSWORD não está definido.');
  try {
    validatePasswordStrength(password);
  } catch {
    throw new SeedError('SEED_DEV_PASSWORD não cumpre a política de passwords.');
  }

  return { confirmed: argv.includes('--confirm') };
}

async function writeSeed(password) {
  const passwordHash = await passwordHasher.hash(password);

  const { _id: customerId, ...customer } = DEV_CUSTOMER;
  await Customers.updateOne({ _id: customerId }, { $set: customer }, { upsert: true });

  for (const { email, roles, customerId: linkedCustomer = null } of DEV_USERS) {
    await Users.updateOne(
      { email },
      {
        $set: {
          roles,
          customerId: linkedCustomer,
          status: AccountStatus.ACTIVE,
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
        },
        $inc: { tokenVersion: 1 }, // ends sessions opened with the previous password
      },
      { upsert: true, runValidators: true },
    );
  }
  return DEV_USERS.map(({ email, roles }) => ({ email, roles: roles.join(', ') || '(sem roles)' }));
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const password = process.env.SEED_DEV_PASSWORD;
  const { confirmed } = checkPreconditions({
    nodeEnv: process.env.NODE_ENV,
    argv: process.argv,
    uri,
    password,
  });

  console.log(`Destino: ${describeTarget(uri)}`);
  if (!confirmed) {
    console.log('Nada foi escrito. Para continuar: npm run seed:dev-users -- --confirm');
    process.exitCode = 1;
    return;
  }

  await connectDB(uri);
  try {
    console.table(await writeSeed(password));
    console.log('Utilizadores de desenvolvimento prontos (password: SEED_DEV_PASSWORD).');
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`Seed de utilizadores falhou: ${err.message}`);
    process.exitCode = 1;
  });
}
