import * as defaultForecastRepository from '../../infrastructure/forecast/forecast.repository.js';
import { AppError } from '../app-error.js';

export function toForecastDto(forecast) {
  return {
    id: forecast._id || forecast.id,
    name: forecast.name,
    version: forecast.version,
    startDate: forecast.startDate,
    endDate: forecast.endDate,
    entries: forecast.entries,
    isActive: forecast.isActive !== false,
  };
}

export async function listForecasts(filters = {}, forecastRepository = defaultForecastRepository) {
  const forecasts = filters.name
    ? await forecastRepository.search(filters.name)
    : await forecastRepository.list();
  return forecasts.filter((f) => f.isActive !== false).map(toForecastDto);
}

export async function getForecastById(id, forecastRepository = defaultForecastRepository) {
  const forecast = await forecastRepository.findById(id);
  if (!forecast || forecast.isActive === false) throw new AppError('Forecast not found.', 404);
  return toForecastDto(forecast);
}

export async function createForecast(forecastData, forecastRepository = defaultForecastRepository) {
  try {
    const newForecast = await forecastRepository.create({ ...forecastData, isActive: true });
    return toForecastDto(newForecast);
  } catch (err) {
    if (err.code === 11000) throw new AppError('Forecast name already in use.', 409);
    throw err;
  }
}

export async function updateForecast(id, updateData, forecastRepository = defaultForecastRepository) {
  if (updateData.isActive !== false) throw new AppError('Only deactivation is supported.', 400);
  const forecast = await forecastRepository.findById(id);
  if (!forecast || forecast.isActive === false) throw new AppError('Forecast not found.', 404);
  
  const deactivated = await forecastRepository.update(id, { isActive: false });
  return toForecastDto(deactivated);
}
