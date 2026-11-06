import * as kitchenConfigService from '../../application/kitchen-configuration/kitchen-configuration.service.js';

export const list = async (req, res, next, kitchenRepo) => {
  try {
    const configs = await kitchenConfigService.listConfigurations(kitchenRepo);
    res.status(200).json(configs);
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next, kitchenRepo) => {
  try {
    const newConfig = await kitchenConfigService.createConfiguration(req.body, kitchenRepo);
    res.status(201).json(newConfig);
  } catch (err) {
    next(err);
  }
};

export const validate = async (req, res, next) => {
  try {
    const result = kitchenConfigService.validateConfigurationContent(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getActive = async (req, res, next, kitchenRepo) => {
  try {
    const activeConfig = await kitchenConfigService.getActiveConfiguration(kitchenRepo);
    res.status(200).json(activeConfig);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next, kitchenRepo) => {
  try {
    const config = await kitchenConfigService.getConfigurationById(req.params.id, kitchenRepo);
    res.status(200).json(config);
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next, kitchenRepo) => {
  try {
    const updatedConfig = await kitchenConfigService.updateConfiguration(
      req.params.id,
      req.body,
      kitchenRepo,
    );
    res.status(200).json(updatedConfig);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next, kitchenRepo) => {
  try {
    await kitchenConfigService.removeConfiguration(req.params.id, kitchenRepo);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const activate = async (req, res, next, kitchenRepo) => {
  try {
    const activatedConfig = await kitchenConfigService.activateConfiguration(
      req.params.id,
      kitchenRepo,
    );
    res.status(200).json(activatedConfig);
  } catch (err) {
    next(err);
  }
};