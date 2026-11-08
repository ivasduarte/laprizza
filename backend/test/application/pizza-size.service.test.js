import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSize,
  listSizes,
  getSizeById,
  updateSize,
} from '../../src/application/pizza-size/pizza-size.service.js';

const SIZE_ID = 'd0d0d0000000000000000001';
const OTHER_SIZE_ID = 'd0d0d0000000000000000002';

const duplicateKeyError = () =>
  Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { name: 1 } });

/** Size repository whose findById returns `size` and whose update merges the patch into it. */
const createSizeRepository = (size) => ({
  findById: mock.fn(async (id) => (size && String(id) === String(size._id) ? size : null)),
  update: mock.fn(async (_id, data) => ({ ...size, ...data })),
});

test('createSize creates a new size and returns DTO', async () => {
  const repo = { create: mock.fn(async (data) => ({ _id: SIZE_ID, isActive: true, ...data })) };
  const size = await createSize({ name: 'Small' }, repo);

  assert.ok(size.id);
  assert.equal(size.name, 'Small');
  assert.equal(size.isActive, true);
  assert.equal(size._id, undefined); // Prova que DTO limpou campos internos da BD
  assert.equal(repo.create.mock.calls[0].arguments[0].name, 'Small');
});

test('createSize returns 409 Conflict on duplicate name', async () => {
  const repo = {
    create: mock.fn(async () => {
      throw duplicateKeyError();
    }),
  };

  await assert.rejects(
    async () => await createSize({ name: 'medium' }, repo),
    (err) => err.status === 409 && err.message === 'Pizza size already in use.',
  );
});

test('listSizes returns all sizes or filters by search query', async () => {
  const repo = {
    listPizzaSizes: mock.fn(async () => [
      { _id: SIZE_ID, name: 'Small', isActive: true },
      { _id: OTHER_SIZE_ID, name: 'Medium', isActive: true },
    ]),
  };

  const all = await listSizes({}, repo);
  assert.equal(all.length, 2);
  assert.deepEqual(repo.listPizzaSizes.mock.calls[0].arguments[0], {});

  repo.listPizzaSizes.mock.mockImplementationOnce(async () => [
    { _id: OTHER_SIZE_ID, name: 'Medium', isActive: true },
  ]);
  const filtered = await listSizes({ search: 'med' }, repo);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Medium');
  assert.deepEqual(repo.listPizzaSizes.mock.calls[1].arguments[0], { search: 'med' });
});

test('getSizeById returns correct size or throws 404', async () => {
  const repo = createSizeRepository({ _id: SIZE_ID, name: 'Large', isActive: true });

  const found = await getSizeById(SIZE_ID, repo);
  assert.equal(found.name, 'Large');

  await assert.rejects(
    async () => await getSizeById('fake_id', repo),
    (err) => err.status === 404 && err.message === 'Pizza size not found.',
  );
});

test('updateSize modifies partial data safely', async () => {
  const repo = createSizeRepository({ _id: SIZE_ID, name: 'Family', isActive: true });
  const productsRepo = { existsWithSizeConfigurationForPizzaSize: mock.fn(async () => false) };

  const updated = await updateSize(SIZE_ID, { isActive: false }, repo, productsRepo);
  assert.equal(updated.isActive, false);
  assert.equal(updated.name, 'Family'); // Mantém o nome original
  assert.deepEqual(repo.update.mock.calls[0].arguments, [SIZE_ID, { isActive: false }]);
});

test('updateSize refuses to deactivate a size used by a size configuration', async () => {
  const repo = createSizeRepository({ _id: SIZE_ID, name: 'Large', isActive: true });
  const productsRepo = { existsWithSizeConfigurationForPizzaSize: mock.fn(async () => true) };

  await assert.rejects(
    async () => await updateSize(SIZE_ID, { isActive: false }, repo, productsRepo),
    (err) =>
      err.status === 409 &&
      err.message === 'Pizza size has size configurations and cannot be removed.',
  );

  assert.equal(
    productsRepo.existsWithSizeConfigurationForPizzaSize.mock.calls[0].arguments[0],
    SIZE_ID,
  );
  assert.equal(repo.update.mock.callCount(), 0); // Não foi desativado
});

test('updateSize deactivates a size when only other sizes are used by configurations', async () => {
  const repo = createSizeRepository({ _id: SIZE_ID, name: 'Small', isActive: true });
  // Only OTHER_SIZE_ID has configurations.
  const productsRepo = {
    existsWithSizeConfigurationForPizzaSize: mock.fn(async (id) => id === OTHER_SIZE_ID),
  };

  const updated = await updateSize(SIZE_ID, { isActive: false }, repo, productsRepo);
  assert.equal(updated.isActive, false);
  assert.equal(repo.update.mock.callCount(), 1);
});

test('updateSize still allows renaming a size used by a size configuration', async () => {
  const repo = createSizeRepository({ _id: SIZE_ID, name: 'Large', isActive: true });
  const productsRepo = { existsWithSizeConfigurationForPizzaSize: mock.fn(async () => true) };

  const updated = await updateSize(SIZE_ID, { name: 'Extra Large' }, repo, productsRepo);
  assert.equal(updated.name, 'Extra Large');
  assert.equal(updated.isActive, true);
  assert.equal(productsRepo.existsWithSizeConfigurationForPizzaSize.mock.callCount(), 0);
});

test('updateSize throws 404 for unknown IDs and 409 for duplicate names', async () => {
  const repo = createSizeRepository({ _id: OTHER_SIZE_ID, name: 'S2', isActive: true });
  repo.update.mock.mockImplementation(async () => {
    throw duplicateKeyError();
  });

  await assert.rejects(
    async () => await updateSize('fake_id', { name: 'S3' }, repo),
    (err) => err.status === 404,
  );
  assert.equal(repo.update.mock.callCount(), 0);

  await assert.rejects(
    async () => await updateSize(OTHER_SIZE_ID, { name: 's1' }, repo),
    (err) => err.status === 409,
  );
});
