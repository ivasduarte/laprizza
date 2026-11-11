import Users from './users/users.model.js';

import KitchenConfiguration from './kitchen-configuration/kitchen-configuration.model.js';

import * as pizzaComponentTypesRepository from './pizza-component-type/pizza-component-type.repository.js';

import { passwordHasher } from './security/password-hasher.js';
import { Roles, AccountStatus, validatePasswordStrength } from '../domain/users/users.domain.js';
import { DEFAULT_PIZZA_COMPONENT_TYPES } from '../domain/pizza-component-type/pizza-component-types.domain.js';

/** MongoDB error code for violation of a unique index. */
const DUPLICATE_KEY_ERROR_CODE = 11000;

/**
 * Bootstrapping function that seeds the initial Manager account into the database.
 * Checks if at least one user with the MANAGER role exists. If not, it creates a default
 * 'admin' account using the password defined in the SEED_MANAGER_PASSWORD environment variable.
 * This ensures the system is accessible upon first deployment.
 *
 * @returns {Promise<void>}
 * @throws {Error} Throws a fatal error if the SEED_MANAGER_PASSWORD environment variable is missing or fails strength validation.
 */
export async function seedInitialManager() {
  const managerExists = await Users.findOne({ role: Roles.MANAGER });

  if (!managerExists) {
    console.log('No manager found. Creating initial account...');

    const pw = process.env.SEED_MANAGER_PASSWORD;
    if (!pw) throw new Error('Fatal: SEED_MANAGER_PASSWORD environment variable is missing.');

    validatePasswordStrength(pw);

    await Users.create({
      username: 'admin',
      email: 'admin@laprizza.pt',
      passwordHash: await passwordHasher.hash(pw),
      role: Roles.MANAGER,
      status: AccountStatus.ACTIVE,
    });
    console.log('Initial Manager account created successfully.');
  } else {
    console.log('Account Manager already exists. Seeder ignored.');
  }
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