import * as assemblyLineConfigService from '../../application/assembly-line-configuration/assembly-line-configuration.service.js';

export const list = async (req, res, next, assemblyLineRepo) => {
  try {
    const configs = await assemblyLineConfigService.listConfigurations(assemblyLineRepo);
    res.status(200).json(configs);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next, assemblyLineRepo) => {
  try {
    const newConfig = await assemblyLineConfigService.createConfiguration(
      req.body,
      assemblyLineRepo,
    );
    res.status(201).json(newConfig);
  } catch (error) {
    next(error);
  }
};

export const validate = async (req, res, next) => {
  try {
    const result = assemblyLineConfigService.validateConfigurationContent(req.body.content);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next, assemblyLineRepo) => {
  try {
    const config = await assemblyLineConfigService.getConfigurationById(
      req.params.id,
      assemblyLineRepo,
    );
    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next, assemblyLineRepo) => {
  try {
    const config = await assemblyLineConfigService.updateConfiguration(
      req.params.id,
      req.body,
      assemblyLineRepo,
    );
    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next, assemblyLineRepo) => {
  try {
    await assemblyLineConfigService.removeConfiguration(req.params.id, assemblyLineRepo);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
