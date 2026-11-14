import * as defaultAssemblyLineRepo from '../../infrastructure/assembly-line-configuration/assembly-line-configuration.repository.js';
import {
  createAssemblyLineConfigurationData,
  validateAssemblyLineConfigurationContent,
} from '../../domain/assembly-line-configuration/assembly-line-configuration.domain.js';
import { DomainError } from '../../domain/domain-error.js';
import { AppError } from '../app-error.js';

const NOT_FOUND_MESSAGE = 'Assembly Line configuration not found.';

function toAppError(err) {
  // DomainError carries the individual violations (with property paths) in `details`.
  return new AppError(err.message, 400, err.details);
}

export function toAssemblyLineConfigurationDto(config) {
  return {
    id: config._id || config.id,
    name: config.name,
    content: config.content,
  };
}

export async function listConfigurations(assemblyLineRepo = defaultAssemblyLineRepo) {
  const configs = await assemblyLineRepo.list();
  return configs.map(toAssemblyLineConfigurationDto);
}

export async function getConfigurationById(id, assemblyLineRepo = defaultAssemblyLineRepo) {
  const config = await assemblyLineRepo.findById(id);
  if (!config) throw new AppError(NOT_FOUND_MESSAGE, 404);
  return toAssemblyLineConfigurationDto(config);
}

export async function createConfiguration(data, assemblyLineRepo = defaultAssemblyLineRepo) {
  try {
    const validData = createAssemblyLineConfigurationData(data.name, data.content);
    const newConfig = await assemblyLineRepo.create(validData);
    return toAssemblyLineConfigurationDto(newConfig);
  } catch (error) {
    if (error instanceof DomainError) throw toAppError(error);
    throw error;
  }
}

/**
 * Content changes are fully validated before being saved, so a kitchen configuration
 * that references this line never receives an invalid definition.
 */
export async function updateConfiguration(
  id,
  updateData,
  assemblyLineRepo = defaultAssemblyLineRepo,
) {
  const config = await assemblyLineRepo.findById(id);
  if (!config) throw new AppError(NOT_FOUND_MESSAGE, 404);
  const dataToSave = {};
  try {
    if (updateData.name !== undefined) {
      if (typeof updateData.name !== 'string' || updateData.name.trim().length === 0) {
        throw new DomainError('Name is required and cannot be empty.');
      }
      dataToSave.name = updateData.name.trim();
    }
    if (updateData.content !== undefined) {
      dataToSave.content = validateAssemblyLineConfigurationContent(updateData.content);
    }
  } catch (error) {
    if (error instanceof DomainError) throw toAppError(error);
    throw error;
  }
  const updatedConfig = await assemblyLineRepo.update(id, dataToSave);
  if (!updatedConfig) throw new AppError(NOT_FOUND_MESSAGE, 404);
  return toAssemblyLineConfigurationDto(updatedConfig);
}

/**
 * A line referenced by any kitchen configuration cannot be deleted: the reference
 * would become unresolvable and that kitchen layout could no longer be loaded.
 */
export async function removeConfiguration(id, assemblyLineRepo = defaultAssemblyLineRepo) {
  const config = await assemblyLineRepo.findById(id);
  if (!config) throw new AppError(NOT_FOUND_MESSAGE, 404);
  const references = await assemblyLineRepo.countKitchenConfigurationReferences(id);
  if (references > 0) {
    throw new AppError(
      `Cannot delete an assembly line configuration referenced by ${references} kitchen configuration(s).`,
      409,
    );
  }
  await assemblyLineRepo.remove(id);
}

export function validateConfigurationContent(content) {
  try {
    validateAssemblyLineConfigurationContent(content);
    return { valid: true };
  } catch (error) {
    if (error instanceof DomainError) throw toAppError(error);
    throw error;
  }
}
