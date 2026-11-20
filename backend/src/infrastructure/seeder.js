import Users from './users/users.model.js';
import RoleChange from './users/role-change.model.js';

import KitchenConfiguration from './kitchen-configuration/kitchen-configuration.model.js';

import * as pizzaComponentTypesRepository from './pizza-component-type/pizza-component-type.repository.js';

import { passwordHasher } from './security/password-hasher.js';
import {
  Roles,
  AccountStatus,
  validatePasswordStrength,
  withInitialCustomerRole,
} from '../domain/users/users.domain.js';
import {
  SystemProcess,
  initialRoleChanges,
  systemActor,
} from '../domain/users/role-changes.domain.js';
import { DEFAULT_PIZZA_COMPONENT_TYPES } from '../domain/pizza-component-type/pizza-component-types.domain.js';

/** MongoDB error code for violation of a unique index. */
const DUPLICATE_KEY_ERROR_CODE = 11000;

/**
 * Bootstrapping function that seeds the first account of an empty database (AA06).
 * The account holds ADMINISTRATOR (user administration) and MANAGER (restaurant management),
 * plus the automatic CUSTOMER role (AA03), with the password in SEED_MANAGER_PASSWORD.
 * Its role assignments are recorded as made by the seeding process.
 *
 * A database that already has a Manager but no Administrator was created before AA06:
 * the data migration promotes its first Administrator, so the start is refused until it runs.
 *
 * @returns {Promise<void>}
 * @throws {Error} If the migrations are missing, or SEED_MANAGER_PASSWORD is missing or weak.
 */
export async function seedInitialAccount() {
  const legacy = await Users.collection.findOne(
    { role: { $exists: true } },
    { projection: { _id: 1 } },
  );

  if (legacy) {
    throw new Error('Fatal: users still have the legacy "role" field. Run "npm run migrate:up" (AA05).');
  }

  if (await Users.exists({ roles: Roles.ADMINISTRATOR })) {
    console.log('An Administrator already exists. Seeder ignored.');
    return;
  }
  if (await Users.exists({ roles: Roles.MANAGER })) {
    throw new Error('Fatal: there is no Administrator. Run "npm run migrate:up" (AA06).');
  }

  console.log('No Administrator found. Creating the initial account...');
  const pw = process.env.SEED_MANAGER_PASSWORD;
  if (!pw) throw new Error('Fatal: SEED_MANAGER_PASSWORD environment variable is missing.');
  validatePasswordStrength(pw);

  const now = new Date();
  const account = await Users.create({
    username: 'admin',
    email: 'admin@laprizza.pt',
    passwordHash: await passwordHasher.hash(pw),
    roles: withInitialCustomerRole([Roles.ADMINISTRATOR, Roles.MANAGER]),
    status: AccountStatus.ACTIVE,
    activatedAt: now,
  });
  await RoleChange.insertMany(
    initialRoleChanges({
      userId: account._id,
      roles: account.roles,
      actor: systemActor(SystemProcess.INITIAL_ACCOUNT_SEED),
      at: now,
    }),
  );
  console.log('Initial Administrator account created successfully.');
}

export async function seedInitialPizzaComponentTypes() {
  for (const type of DEFAULT_PIZZA_COMPONENT_TYPES) {
    const existing = await pizzaComponentTypesRepository.searchByName(type.name);

    if (existing.length > 0) continue;

    try {
      await pizzaComponentTypesRepository.create({ ...type });
      console.log(`Pizza component type "${type.name}" created.`);
    } catch (err) {
      if (err.code !== DUPLICATE_KEY_ERROR_CODE) throw err;
      console.warn(
        `Pizza component type "${type.name}" skipped: its assembly order is already in use.`,
      );
    }
  }
}

export async function seedInitialKitchenConfigurations() {
  const count = await KitchenConfiguration.countDocuments();
  if (count > 0) {
    console.log('Kitchen configurations already exist. Seeder ignored.');
    return;
  }

  console.log('No kitchen configurations found. Seeding default layouts...');

  // Layout 1: Standard
  const standardContent = {
    dimensions: { width: 10.5, length: 15.0, height: 3.2 },
    elements: [
      {
        id: 'oven-01',
        type: 'equipment',
        modelReference: '/assets/models/oven.glb',
        position: { x: 2.0, y: 0.0, z: -4.5 },
        rotation: { x: 0.0, y: 90.0, z: 0.0 },
        scale: { x: 1.0, y: 1.0, z: 1.0 },
      },
    ],
  };

  // Layout 2: Automated Line
  const automatedContent = {
    dimensions: { width: 12.0, length: 20.0, height: 4.0 },
    elements: [
      {
        id: 'conveyor-belt-main',
        type: 'assembly-line',
        modelReference: '/assets/models/convyor-belt.glb',
        position: { x: 0.0, y: 0.85, z: 0.0 },
        rotation: { x: 0.0, y: 0.0, z: 0.0 },
        scale: { x: 8.0, y: 1.0, z: 1.2 },
      },
    ],
  };

  await KitchenConfiguration.create([
    { name: 'Standard Kitchen Layout', content: standardContent, isActive: true },
    { name: 'Automated Assembly Line', content: automatedContent, isActive: false },
  ]);

  console.log('Initial Kitchen configurations seeded successfully.');
}