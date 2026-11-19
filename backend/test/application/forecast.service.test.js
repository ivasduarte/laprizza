import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createForecast,
  toForecastDto,
  updateForecast,
} from '../../src/application/forecast/forecast.service.js';
import { findForecastProblems, isRealDay } from '../../src/application/forecast/forecast.rules.js';

const PIZZA = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const DRINK = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const RAW = 'aaaaaaaaaaaaaaaaaaaaaaa3';
const MEDIUM = 'bbbbbbbbbbbbbbbbbbbbbbb1';
const LARGE = 'bbbbbbbbbbbbbbbbbbbbbbb2';
const SMALL = 'bbbbbbbbbbbbbbbbbbbbbbb3';

const catalogue = () => ({
  listProducts: async () => [
    { _id: PIZZA, sellable: true },
    { _id: DRINK, sellable: true },
    { _id: RAW, sellable: false },
  ],
  listPredefinedPizzas: async () => [{ productId: PIZZA, sizeIds: [MEDIUM, LARGE] }],
});

function fakeRepository({ latestVersion = 0, failWith } = {}) {
  const created = [];
  return {
    created,
    getLatestVersion: async () => latestVersion,
    create: async (data) => {
      if (failWith) throw failWith;
      created.push(data);
      return { _id: 'f1', ...data };
    },
    findById: async (id) => (id === 'f1' ? { _id: 'f1', isActive: true } : null),
    update: async (id, data) => ({ _id: id, name: 'n', version: 1, entries: [], ...data }),
  };
}

const valid = (over = {}) => ({
  name: 'Week 47',
  startDate: '2026-11-23',
  endDate: '2026-11-29',
  entries: [
    { date: '2026-11-23', productId: PIZZA, sizeId: MEDIUM, quantity: 20 },
    { date: '2026-11-24', productId: PIZZA, sizeId: MEDIUM, quantity: 35 },
    { date: '2026-11-24', productId: DRINK, sizeId: null, quantity: 10 },
  ],
  ...over,
});

const types = (problems) => problems.map((p) => p.type);
const reject = async (data) => {
  await assert.rejects(
    () => createForecast(data, fakeRepository(), catalogue()),
    (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.code, 'VALIDATION_ERROR');
      reject.last = err.details;
      return true;
    },
  );
  return reject.last;
};

describe('createForecast', () => {
  it('creates version 1 of a new name', async () => {
    const repo = fakeRepository();
    const dto = await createForecast(valid(), repo, catalogue());
    assert.equal(repo.created[0].version, 1);
    assert.equal(dto.version, 1);
    assert.equal(dto.startDate, '2026-11-23');
    assert.equal(dto.entries[2].sizeId, null);
  });

  it('creates the next version when the name already exists (earlier versions are kept)', async () => {
    const repo = fakeRepository({ latestVersion: 2 });
    const dto = await createForecast(valid(), repo, catalogue());
    assert.equal(dto.version, 3);
  });

  it('ignores a version sent by the client', async () => {
    const repo = fakeRepository({ latestVersion: 1 });
    await createForecast(valid({ version: 99 }), repo, catalogue());
    assert.equal(repo.created[0].version, 2);
  });

  it('rejects an unknown or not sellable product', async () => {
    const unknown = valid({ entries: [{ date: '2026-11-23', productId: 'cccccccccccccccccccccccc', quantity: 1 }] });
    assert.deepEqual(types(await reject(unknown)), ['productUnknown']);
    const raw = valid({ entries: [{ date: '2026-11-23', productId: RAW, quantity: 1 }] });
    assert.deepEqual(types(await reject(raw)), ['productUnknown']);
  });

  it('rejects an incompatible size, a missing size and a size on a product without sizes', async () => {
    const wrong = valid({ entries: [{ date: '2026-11-23', productId: PIZZA, sizeId: SMALL, quantity: 1 }] });
    assert.deepEqual(types(await reject(wrong)), ['sizeIncompatible']);
    const missing = valid({ entries: [{ date: '2026-11-23', productId: PIZZA, quantity: 1 }] });
    assert.deepEqual(types(await reject(missing)), ['sizeRequired']);
    const drink = valid({ entries: [{ date: '2026-11-23', productId: DRINK, sizeId: MEDIUM, quantity: 1 }] });
    assert.deepEqual(types(await reject(drink)), ['sizeIncompatible']);
  });

  it('rejects dates outside the period', async () => {
    const outside = valid({ entries: [{ date: '2026-11-30', productId: PIZZA, sizeId: MEDIUM, quantity: 1 }] });
    const problems = await reject(outside);
    assert.deepEqual(types(problems), ['dateOutside']);
    assert.equal(problems[0].field, 'entries[0].date');
  });

  it('rejects duplicate date/product/size entries', async () => {
    const entry = { date: '2026-11-23', productId: PIZZA, sizeId: MEDIUM, quantity: 1 };
    assert.deepEqual(types(await reject(valid({ entries: [entry, { ...entry, quantity: 2 }] }))), ['duplicate']);
  });

  it('accepts the same product on the same day with different sizes', async () => {
    const entries = [
      { date: '2026-11-23', productId: PIZZA, sizeId: MEDIUM, quantity: 1 },
      { date: '2026-11-23', productId: PIZZA, sizeId: LARGE, quantity: 2 },
    ];
    await createForecast(valid({ entries }), fakeRepository(), catalogue());
  });

  it('rejects an inverted period, an invalid date and a forecast without entries', async () => {
    assert.ok(types(await reject(valid({ startDate: '2026-12-01' }))).includes('periodInvalid'));
    assert.ok(types(await reject(valid({ endDate: '2026-02-30' }))).includes('dateInvalid'));
    assert.deepEqual(types(await reject(valid({ entries: [] }))), ['noEntries']);
  });

  it('accepts zero quantities (omitted entries mean zero, an explicit zero is valid)', async () => {
    const entries = [{ date: '2026-11-23', productId: PIZZA, sizeId: MEDIUM, quantity: 0 }];
    await createForecast(valid({ entries }), fakeRepository(), catalogue());
  });

  it('answers 409 when two saves race for the same version', async () => {
    const repo = fakeRepository({ failWith: Object.assign(new Error('dup'), { code: 11000 }) });
    await assert.rejects(() => createForecast(valid(), repo, catalogue()), { status: 409 });
  });

  it('needs the catalogue reader', async () => {
    await assert.rejects(() => createForecast(valid(), fakeRepository()), /catalogueReader/);
  });
});

describe('forecast rules and dto', () => {
  it('validates real calendar days', () => {
    assert.equal(isRealDay('2026-02-28'), true);
    assert.equal(isRealDay('2026-02-30'), false);
    assert.equal(isRealDay('26-2-3'), false);
  });

  it('reports every problem at once', () => {
    const problems = findForecastProblems(
      valid({ entries: [{ date: '2027-01-01', productId: SMALL, quantity: 1 }] }),
      { products: [], pizzas: [] },
    );
    assert.deepEqual(types(problems).sort(), ['dateOutside', 'productUnknown']);
  });

  it('formats dates as YYYY-MM-DD and ids as strings', () => {
    const dto = toForecastDto({
      _id: { toString: () => 'abc' },
      name: 'n',
      version: 2,
      startDate: new Date('2026-11-23T00:00:00.000Z'),
      endDate: new Date('2026-11-29T00:00:00.000Z'),
      entries: [{ date: new Date('2026-11-23T00:00:00.000Z'), productId: PIZZA, sizeId: null, quantity: 3 }],
    });
    assert.equal(dto.id, 'abc');
    assert.equal(dto.startDate, '2026-11-23');
    assert.deepEqual(dto.entries[0], { date: '2026-11-23', productId: PIZZA, sizeId: null, quantity: 3 });
  });
});

describe('updateForecast (delete = deactivate)', () => {
  it('only accepts deactivation', async () => {
    await assert.rejects(() => updateForecast('f1', { isActive: true }, fakeRepository()), { status: 400 });
    const dto = await updateForecast('f1', { isActive: false }, fakeRepository());
    assert.equal(dto.isActive, false);
  });
  it('404 when it does not exist', async () => {
    await assert.rejects(() => updateForecast('nope', { isActive: false }, fakeRepository()), { status: 404 });
  });
});
