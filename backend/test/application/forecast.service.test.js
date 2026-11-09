import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createForecast,
  getForecastById,
  listForecasts,
  updateForecast,
} from '../../src/application/forecast/forecast.service.js';

const FORECAST_ID = 'f0ca57000000000000000001';
const PRODUCT_ID = 'd0d0c7000000000000000001';

const duplicateKeyError = () => Object.assign(new Error('Duplicate key'), { code: 11000 });

const forecastData = () => ({
  name: 'Forecast Novembro',
  version: 1,
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  entries: [{ date: '2026-11-01', productId: PRODUCT_ID, sizeId: null, quantity: 10 }],
});

test('createForecast stores as active and maps DTO', async () => {
  const forecastRepository = {
    create: mock.fn(async (data) => ({ _id: FORECAST_ID, ...data })),
  };

  const forecast = await createForecast(forecastData(), forecastRepository);

  assert.equal(forecastRepository.create.mock.callCount(), 1);
  assert.deepEqual(forecastRepository.create.mock.calls[0].arguments[0], {
    ...forecastData(),
    isActive: true,
  });
  assert.ok(forecast.id);
  assert.equal(forecast.name, 'Forecast Novembro');
  assert.equal(forecast.version, 1);
  assert.equal(forecast.startDate, '2026-11-01');
  assert.equal(forecast.endDate, '2026-11-30');
  assert.equal(forecast.entries.length, 1);
  assert.equal(forecast.isActive, true);
  assert.equal(forecast._id, undefined);
});

test('createForecast rejects duplicate names', async () => {
  const forecastRepository = {
    create: mock.fn(async () => {
      throw duplicateKeyError();
    }),
  };

  await assert.rejects(
    async () => await createForecast(forecastData(), forecastRepository),
    (err) => err.status === 409 && err.message.includes('already in use'),
  );
  assert.equal(forecastRepository.create.mock.callCount(), 1);
});

test('createForecast rethrows unexpected repository errors', async () => {
  const forecastRepository = {
    create: mock.fn(async () => {
      throw new Error('Connection lost');
    }),
  };

  await assert.rejects(
    async () => await createForecast(forecastData(), forecastRepository),
    (err) => err.message === 'Connection lost',
  );
});

test('getForecastById and listForecasts filter inactives and map DTO', async () => {
  const inactive = { _id: FORECAST_ID, ...forecastData(), isActive: false };
  const forecastRepository = {
    findById: mock.fn(async () => inactive),
    list: mock.fn(async () => [inactive]),
    search: mock.fn(async () => []),
  };

  await assert.rejects(
    async () => await getForecastById(FORECAST_ID, forecastRepository),
    (err) => err.status === 404,
  );
  assert.equal(forecastRepository.findById.mock.calls[0].arguments[0], FORECAST_ID);

  const list = await listForecasts({}, forecastRepository);
  assert.equal(list.length, 0);
  assert.equal(forecastRepository.list.mock.callCount(), 1);
  assert.equal(forecastRepository.search.mock.callCount(), 0);
});

test('getForecastById rejects missing forecasts and maps active ones', async () => {
  const stored = { _id: FORECAST_ID, ...forecastData(), isActive: true };
  const forecastRepository = {
    findById: mock.fn(async (id) => (id === FORECAST_ID ? stored : null)),
  };

  await assert.rejects(
    async () => await getForecastById('f0ca57000000000000000099', forecastRepository),
    (err) => err.status === 404,
  );

  const forecast = await getForecastById(FORECAST_ID, forecastRepository);
  assert.equal(forecast.id, FORECAST_ID);
  assert.equal(forecast.name, 'Forecast Novembro');
  assert.equal(forecast._id, undefined);
});

test('listForecasts uses search when a name filter is given', async () => {
  const active = { _id: FORECAST_ID, ...forecastData(), isActive: true };
  const forecastRepository = {
    list: mock.fn(async () => []),
    search: mock.fn(async () => [active]),
  };

  const list = await listForecasts({ name: 'novembro' }, forecastRepository);

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Forecast Novembro');
  assert.equal(forecastRepository.search.mock.calls[0].arguments[0], 'novembro');
  assert.equal(forecastRepository.list.mock.callCount(), 0);
});

test('updateForecast allows only deactivation', async () => {
  const active = { _id: FORECAST_ID, ...forecastData(), isActive: true };
  const forecastRepository = {
    findById: mock.fn(async () => active),
    update: mock.fn(async (_id, data) => ({ ...active, ...data })),
  };

  await assert.rejects(
    async () => await updateForecast(FORECAST_ID, { name: 'Outro' }, forecastRepository),
    (err) => err.status === 400 && err.message.includes('Only deactivation is supported'),
  );
  assert.equal(forecastRepository.findById.mock.callCount(), 0);
  assert.equal(forecastRepository.update.mock.callCount(), 0);

  const deactivated = await updateForecast(FORECAST_ID, { isActive: false }, forecastRepository);
  assert.equal(deactivated.isActive, false);
  assert.deepEqual(forecastRepository.update.mock.calls[0].arguments, [
    FORECAST_ID,
    { isActive: false },
  ]);
});

test('updateForecast rejects missing or already inactive forecasts', async () => {
  const forecastRepository = {
    findById: mock.fn(async () => null),
    update: mock.fn(async () => null),
  };

  await assert.rejects(
    async () => await updateForecast(FORECAST_ID, { isActive: false }, forecastRepository),
    (err) => err.status === 404,
  );

  forecastRepository.findById.mock.mockImplementation(async () => ({
    _id: FORECAST_ID,
    ...forecastData(),
    isActive: false,
  }));
  await assert.rejects(
    async () => await updateForecast(FORECAST_ID, { isActive: false }, forecastRepository),
    (err) => err.status === 404,
  );
  assert.equal(forecastRepository.update.mock.callCount(), 0);
});
