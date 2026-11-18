import * as defaultForecastRepository from '../../infrastructure/forecast/forecast.repository.js';
import { AppError } from '../app-error.js';
import { findForecastProblems, toDay } from './forecast.rules.js';

export function toForecastDto(forecast) {
  return {
    id: String(forecast._id ?? forecast.id),
    name: forecast.name,
    version: forecast.version,
    startDate: toDay(forecast.startDate),
    endDate: toDay(forecast.endDate),
    entries: (forecast.entries ?? []).map((e) => ({
      date: toDay(e.date),
      productId: String(e.productId),
      sizeId: e.sizeId ? String(e.sizeId) : null,
      quantity: e.quantity,
    })),
    isActive: forecast.isActive !== false,
  };
}

export async function listForecasts(filters = {}, forecastRepository = defaultForecastRepository) {
  const forecasts = filters.name
    ? await forecastRepository.search(filters.name)
    : await forecastRepository.list();

  const activeForecasts = forecasts.filter((f) => f.isActive !== false);
  return activeForecasts.map(toForecastDto);
}

export async function getForecastById(id, forecastRepository = defaultForecastRepository) {
  const forecast = await forecastRepository.findById(id);

  if (!forecast || forecast.isActive === false) {
    throw new AppError('Forecast not found.', 404);
  }

  return toForecastDto(forecast);
}

/**
 * Creates a forecast. Forecasts are immutable: saving a name that already exists creates the next
 * version (v1, v2, ...) and older versions are kept, so results already calculated keep meaning.
 *
 * @param {object} forecastData validated body (name, startDate, endDate, entries)
 * @param {object} forecastRepository
 * @param {{listProducts: Function, listPredefinedPizzas: Function}} catalogueReader read-only catalogue (ai-data repository)
 */
export async function createForecast(
  forecastData,
  forecastRepository = defaultForecastRepository,
  catalogueReader,
) {
  if (!catalogueReader) throw new Error('catalogueReader is required.');
  const [products, pizzas] = await Promise.all([
    catalogueReader.listProducts(),
    catalogueReader.listPredefinedPizzas(),
  ]);
  const problems = findForecastProblems(forecastData, { products, pizzas });
  if (problems.length > 0) {
    throw new AppError('Validation failed.', 400, problems, 'VALIDATION_ERROR');
  }

  const { name, startDate, endDate, entries } = forecastData;
  const version = (await forecastRepository.getLatestVersion(name)) + 1;
  try {
    const created = await forecastRepository.create({
      name,
      version,
      startDate,
      endDate,
      entries: entries.map((e) => ({ ...e, sizeId: e.sizeId ?? null })),
      isActive: true,
    });
    return toForecastDto(created);
  } catch (err) {
    if (err.code === 11000) throw new AppError('Forecast version already exists. Try again.', 409);
    throw err;
  }
}

export async function updateForecast(
  id,
  updateData,
  forecastRepository = defaultForecastRepository,
) {
  if (updateData.isActive !== false) {
    throw new AppError('Only deactivation is supported: isActive must be false.', 400);
  }

  const forecast = await forecastRepository.findById(id);
  if (!forecast || forecast.isActive === false) {
    throw new AppError('Forecast not found.', 404);
  }

  const deactivated = await forecastRepository.update(id, { isActive: false });
  return toForecastDto(deactivated);
}
