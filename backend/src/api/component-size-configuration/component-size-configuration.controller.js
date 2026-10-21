import * as componentSizeConfigurationService from '../../application/component-size-configuration/component-size-configuration.service.js';

export const list = async (req, res, next, repos) => {
  try {
    const configs = await componentSizeConfigurationService.listComponentSizeConfigurations(
      req.params.productId,
      repos,
    );
    res.status(200).json(configs);
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next, repos) => {
  try {
    const newConfig = await componentSizeConfigurationService.createComponentSizeConfiguration(
      req.params.productId,
      req.body,
      repos,
    );
    res.status(201).json(newConfig);
  } catch (error) {
    next(error);
  }
};

export const getBySize = async (req, res, next, repos) => {
  try {
    const config = await componentSizeConfigurationService.getComponentSizeConfiguration(
      req.params.productId,
      req.params.sizeId,
      repos,
    );
    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next, repos) => {
  try {
    const updatedConfig = await componentSizeConfigurationService.updateComponentSizeConfiguration(
      req.params.productId,
      req.params.sizeId,
      req.body,
      repos,
    );
    res.status(200).json(updatedConfig);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next, repos) => {
  try {
    const removedConfig = await componentSizeConfigurationService.removeComponentSizeConfiguration(
      req.params.productId,
      req.params.sizeId,
      repos,
    );
    res.status(200).json(removedConfig);
  } catch (error) {
    next(error);
  }
};
