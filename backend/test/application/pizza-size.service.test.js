import test from 'node:test';
import assert from 'node:assert/strict';
import { createDummyPizzaSizeRepository } from '../infrastructure/pizza-size.dummy.repository.js';
import {
  createSize,
  listSizes,
  getSizeById,
  updateSize,
} from '../../src/application/pizza-size.service.js';

test('createSize creates a new size and returns DTO', async () => {
  const repo = createDummyPizzaSizeRepository();
  const size = await createSize({ name: 'Small' }, repo);

  assert.ok(size.id);
  assert.equal(size.name, 'Small');
  assert.equal(size.isActive, true);
  assert.equal(size._id, undefined); // Prova que DTO limpou campos internos da BD
});

test('createSize returns 409 Conflict on duplicate name', async () => {
  const repo = createDummyPizzaSizeRepository();
  await createSize({ name: 'Medium' }, repo);

  await assert.rejects(
    async () => await createSize({ name: 'medium' }, repo),
    (err) => err.status === 409 && err.message === 'Pizza size already in use.',
  );
});

test('listSizes returns all sizes or filters by search query', async () => {
  const repo = createDummyPizzaSizeRepository();
  await createSize({ name: 'Small' }, repo);
  await createSize({ name: 'Medium' }, repo);

  const all = await listSizes({}, repo);
  assert.equal(all.length, 2);

  const filtered = await listSizes({ search: 'med' }, repo);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Medium');
});

test('getSizeById returns correct size or throws 404', async () => {
  const repo = createDummyPizzaSizeRepository();
  const created = await createSize({ name: 'Large' }, repo);

  const found = await getSizeById(created.id, repo);
  assert.equal(found.name, 'Large');

  await assert.rejects(
    async () => await getSizeById('fake_id', repo),
    (err) => err.status === 404 && err.message === 'Pizza size not found.',
  );
});

test('updateSize modifies partial data safely', async () => {
  const repo = createDummyPizzaSizeRepository();
  const size = await createSize({ name: 'Family' }, repo);

  const updated = await updateSize(size.id, { isActive: false }, repo);
  assert.equal(updated.isActive, false);
  assert.equal(updated.name, 'Family'); // Mantém o nome original
});

test('updateSize throws 404 for unknown IDs and 409 for duplicate names', async () => {
  const repo = createDummyPizzaSizeRepository();
  const s1 = await createSize({ name: 'S1' }, repo);
  const s2 = await createSize({ name: 'S2' }, repo);

  await assert.rejects(
    async () => await updateSize('fake_id', { name: 'S3' }, repo),
    (err) => err.status === 404,
  );

  await assert.rejects(
    async () => await updateSize(s2.id, { name: 's1' }, repo),
    (err) => err.status === 409,
  );
});