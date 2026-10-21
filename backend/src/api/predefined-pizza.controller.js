import * as pizzaService from '../application/predefined-pizza.service.js';

export const list = async (req, res, next, pizzaRepository) => {
  try {
    const pizzas = await pizzaService.listPredefinedPizzas(req.query, pizzaRepository);
    res.status(200).json(pizzas);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next, pizzaRepository) => {
  try {
    const pizza = await pizzaService.createPredefinedPizza(req.body, pizzaRepository);
    res.status(201).json(pizza);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next, pizzaRepository) => {
  try {
    const pizza = await pizzaService.getPredefinedPizzaById(req.params.id, pizzaRepository);
    res.status(200).json(pizza);
  } catch (error) {
    next(error);
  }
};

export const getByName = async (req, res, next, pizzaRepository) => {
  try {
    const pizza = await pizzaService.getPredefinedPizzaByName(req.params.name, pizzaRepository);
    res.status(200).json(pizza);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next, pizzaRepository) => {
  try {
    const pizza = await pizzaService.updatePredefinedPizza(req.params.id, req.body, pizzaRepository);
    res.status(200).json(pizza);
  } catch (error) {
    next(error);
  }
};
