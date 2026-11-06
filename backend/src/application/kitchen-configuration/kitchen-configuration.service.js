import * as defaultKitchenRepo from '../../infrastructure/kitchen-configuration/kitchen-configuration.repository.js';

import {
  createKitchenConfigurationData,
  validateKitchenConfigurationContent,
} from '../../domain/kitchen-configuration/kitchen-configuration.domain.js';

import { DomainError } from '../../domain/domain-error.js';
import { AppError } from '../app-error.js';

export function toKitchenConfigurationDto(config) {
  return {
    id: config._id || config.id,
    name: config.name,
    content: config.content,
    isActive: config.isActive ?? false,
  };
}

export async function listConfigurations(kitchenRepo = defaultKitchenRepo) {
  const configs = await kitchenRepo.list();
  return configs.map(toKitchenConfigurationDto);
}

export async function getConfigurationById(id, kitchenRepo = defaultKitchenRepo) {
  const config = await kitchenRepo.findById(id);
  if (!config) throw new AppError('Kitchen configuration not found.', 404);
  return toKitchenConfigurationDto(config);
}

export async function createConfiguration(data, kitchenRepo = defaultKitchenRepo) {
  try {
    const validData = createKitchenConfigurationData(data.name, data.content, false);
    const newConfig = await kitchenRepo.create(validData);
    return toKitchenConfigurationDto(newConfig);
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }
}

export async function updateConfiguration(id, updateData, kitchenRepo = defaultKitchenRepo) {
  const config = await kitchenRepo.findById(id);
  if (!config) throw new AppError('Kitchen configuration not found.', 404);

  const dataToSave = {};

  try {
    if (updateData.name !== undefined) {
      if (typeof updateData.name !== 'string' || updateData.name.trim().length === 0) {
        throw new DomainError('Name is required and cannot be empty.');
      }
      dataToSave.name = updateData.name.trim();
    }

    if (updateData.content !== undefined) {
      dataToSave.content = validateKitchenConfigurationContent(updateData.content);
    }
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }

  const updatedConfig = await kitchenRepo.update(id, dataToSave);
  return toKitchenConfigurationDto(updatedConfig);
}

export async function removeConfiguration(id, kitchenRepo = defaultKitchenRepo) {
  const config = await kitchenRepo.findById(id);
  if (!config) throw new AppError('Kitchen configuration not found.', 404);

  if (config.isActive) {
    throw new AppError('Cannot delete the active kitchen configuration.', 409);
  }

  await kitchenRepo.remove(id);
}

export function validateConfigurationContent(content) {
  try {
    validateKitchenConfigurationContent(content);
    return { valid: true };
  } catch (err) {
    if (err instanceof DomainError) throw new AppError(err.message, 400);
    throw err;
  }
}

export async function activateConfiguration(id, kitchenRepo = defaultKitchenRepo) {
  const config = await kitchenRepo.findById(id);
  if (!config) throw new AppError('Kitchen configuration not found.', 404);

  if (config.isActive) {
    return toKitchenConfigurationDto(config); // Already active
  }

  try {
    const activated = await kitchenRepo.activateAtomic(id);
    if (!activated) throw new AppError('Failed to activate configuration.', 500);
    return toKitchenConfigurationDto(activated);
  } catch (err) {
    throw new AppError(`Activation failed: ${err.message}`, 500);
  }
}

export async function getActiveConfiguration(kitchenRepo = defaultKitchenRepo) {
  const activeConfig = await kitchenRepo.getActive();

  // ADR-0025: Strict 404 No-Fallback policy
  if (!activeConfig) {
    throw new AppError('No active kitchen configuration found.', 404);
  }

  return toKitchenConfigurationDto(activeConfig);
}