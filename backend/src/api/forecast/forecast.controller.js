import * as forecastService from '../../application/forecast/forecast.service.js';

export const list = async (req, res, next, forecastRepository) => {
  try {
    const forecasts = await forecastService.listForecasts(req.query, forecastRepository);
    res.status(200).json(forecasts);
  } catch (error) { next(error); }
};

export const create = async (req, res, next, forecastRepository) => {
  try {
    const forecast = await forecastService.createForecast(req.body, forecastRepository);
    res.status(201).json(forecast);
  } catch (error) { next(error); }
};

export const getById = async (req, res, next, forecastRepository) => {
  try {
    const forecast = await forecastService.getForecastById(req.params.id, forecastRepository);
    res.status(200).json(forecast);
  } catch (error) { next(error); }
};

export const update = async (req, res, next, forecastRepository) => {
  try {
    const forecast = await forecastService.updateForecast(req.params.id, req.body, forecastRepository);
    res.status(200).json(forecast);
  } catch (error) { next(error); }
};
