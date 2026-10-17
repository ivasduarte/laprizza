import * as argon2 from 'argon2';
import Users from './users.model.js';

import * as pizzaComponentTypesRepository from './pizza-component-type.repository.js';

import { Roles, validatePasswordStrength } from '../domain/users.domain.js';
import { DEFAULT_PIZZA_COMPONENT_TYPES } from '../domain/pizza-component-types.domain.js';

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

    const hashedPassword = await argon2.hash(pw);
    await Users.create({
      username: 'admin',
      email: 'admin@laprizza.pt',
      password: hashedPassword,
      role: Roles.MANAGER,
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
      console.warn(`Pizza component type "${type.name}" skipped: its assembly order is already in use.`);
    }
  }
}