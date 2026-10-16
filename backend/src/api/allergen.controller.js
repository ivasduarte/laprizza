import * as allergenService from '../application/allergen.service.js';

export const list = async (req,res,next,allergenRepository) => {
  try {
    const allergens = await allergenService.listAllergens(req.query,allergenRepository);
    res.status(200).json(allergens);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next, allergenRepository) => {
  try {
    const allergen = await allergenService.createAllergen(req.body, allergenRepository);
    res.status(201).json(allergen);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next, allergenRepository) => {
  try {
    const allergen = await allergenService.getAllergenById(req.params.id, allergenRepository);
    res.status(200).json(allergen);
  } catch (error) {
    next(error);
  }
};

export const getByName = async (req, res, next, allergenRepository) => {
  try {
    const allergen = await allergenService.getAllergenByName(req.params.name, allergenRepository);
    res.status(200).json(allergen);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next, allergenRepository) => {
  try {
    const allergen = await allergenService.updateAllergen(req.params.id, req.body, allergenRepository);
    res.status(200).json(allergen);
  } catch (error) {
    next(error);
  }
};
