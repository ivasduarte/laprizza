import * as defaultStorage from '../../infrastructure/shared-resources/shared-resources.storage.js';
import {
  validateResourceName,
  validateResourceContent,
  MAX_FILE_SIZE_BYTES,
} from '../../domain/shared-resources/shared-resources.domain.js';
import { AppError } from '../app-error.js';

function asBadRequest(fn) {
  try {
    return fn();
  } catch (err) {
    throw new AppError(err.message, 400);
  }
}

const validateName = (name) => asBadRequest(() => validateResourceName(name));

export async function listResources(storage = defaultStorage) {
  return storage.list();
}

export async function getResourcePath(name, storage = defaultStorage) {
  const validName = validateName(name);
  const filePath = await storage.findPath(validName);
  if (!filePath) throw new AppError('Resource not found.', 404);
  return filePath;
}

export async function saveResource(name, content, storage = defaultStorage) {
  const validName = validateName(name);
  if (!Buffer.isBuffer(content) || content.length === 0) {
    throw new AppError(
      'Request body must be the raw file (Content-Type: application/octet-stream).',
      400,
    );
  }
  if (content.length > MAX_FILE_SIZE_BYTES) {
    throw new AppError('File too large.', 413);
  }
  asBadRequest(() => validateResourceContent(validName, content));
  const created = await storage.save(validName, content);
  return { name: validName, size: content.length, created };
}

export async function deleteResource(name, storage = defaultStorage) {
  const validName = validateName(name);
  const removed = await storage.remove(validName);
  if (!removed) throw new AppError('Resource not found.', 404);
}
