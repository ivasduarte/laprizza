import * as pizzaComponentTypeService from '../../application/pizza-component-type/pizza-component-type.service.js';

export const list = async (req, res, next, pizzaComponentTypeRepository) => {
  try {
    const types = await pizzaComponentTypeService.listPizzaComponentTypes(
      req.query.name,
      pizzaComponentTypeRepository,
    );
    res.status(200).json(types);
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next, pizzaComponentTypeRepository) => {
  try {
    const newType = await pizzaComponentTypeService.createPizzaComponentType(
      req.body,
      pizzaComponentTypeRepository,
    );
    res.status(201).json(newType);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next, pizzaComponentTypeRepository) => {
  try {
    const type = await pizzaComponentTypeService.getPizzaComponentTypeById(
      req.params.id,
      pizzaComponentTypeRepository,
    );
    res.status(200).json(type);
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next, pizzaComponentTypeRepository) => {
  try {
    const updatedType = await pizzaComponentTypeService.updatePizzaComponentType(
      req.params.id,
      req.body,
      pizzaComponentTypeRepository,
    );
    res.status(200).json(updatedType);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next, pizzaComponentTypeRepository) => {
  try {
    await pizzaComponentTypeService.removePizzaComponentType(
      req.params.id,
      pizzaComponentTypeRepository,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
