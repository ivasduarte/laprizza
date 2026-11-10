import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { DEFAULT_PIZZA_COMPONENT_TYPES } from '../../src/domain/pizza-component-type/pizza-component-types.domain.js';
import { Roles } from '../../src/domain/users/users.domain.js';
import KitchenConfiguration from '../../src/infrastructure/kitchen-configuration/kitchen-configuration.model.js';
import PizzaComponentType from '../../src/infrastructure/pizza-component-type/pizza-component-type.model.js';
import {
  seedInitialKitchenConfigurations,
  seedInitialManager,
  seedInitialPizzaComponentTypes,
} from '../../src/infrastructure/seeder.js';
import { createMongooseHealthProbe } from '../../src/infrastructure/system/database-health.probe.js';
import Users from '../../src/infrastructure/users/users.model.js';
import { startMongo, STARTUP_TIMEOUT_MS } from '../support/mongo-container.js';

/**
 * Integration tests against a real MongoDB (Testcontainers): migrations, seeders and health probe.
 * Tests in this file run in order and share the same database.
 */
let mongo;

before(
  async () => {
    mongo = await startMongo();
    process.env.SEED_MANAGER_PASSWORD = 'Str0ng!Passw0rd#2026';
  },
  { timeout: STARTUP_TIMEOUT_MS },
);

after(async () => {
  await mongo?.stop();
});

test('every migration is recorded as applied in the changelog', async () => {
  const migrations = (await readdir(new URL('../../migrations/', import.meta.url))).filter((file) =>
    file.endsWith('.js'),
  );
  const applied = await mongoose.connection.db.collection('changelog').countDocuments();

  assert.equal(applied, migrations.length);
});

test('seedInitialManager creates the admin account only once', async () => {
  await seedInitialManager();
  await seedInitialManager();

  const managers = await Users.find({ role: Roles.MANAGER });
  assert.equal(managers.length, 1);
  assert.equal(managers[0].email, 'admin@laprizza.pt');
});

test('seedInitialPizzaComponentTypes creates the default types only once', async () => {
  await seedInitialPizzaComponentTypes();
  await seedInitialPizzaComponentTypes();

  const count = await PizzaComponentType.countDocuments();
  assert.equal(count, [...DEFAULT_PIZZA_COMPONENT_TYPES].length);
});

test('seedInitialKitchenConfigurations creates two layouts, only one active, only once', async () => {
  await seedInitialKitchenConfigurations();
  await seedInitialKitchenConfigurations();

  assert.equal(await KitchenConfiguration.countDocuments(), 2);
  assert.equal(await KitchenConfiguration.countDocuments({ isActive: true }), 1);
});

test('the unique index created by the migration rejects a second active kitchen configuration', async () => {
  await assert.rejects(
    KitchenConfiguration.create({ name: 'Another layout', content: {}, isActive: true }),
    (err) => err.code === 11000,
  );
});

test('the health probe reports the database as healthy only while connected', async () => {
  const probe = createMongooseHealthProbe();
  assert.equal(await probe.isHealthy(), true);

  await mongoose.disconnect();
  assert.equal(await probe.isHealthy(), false);
});
