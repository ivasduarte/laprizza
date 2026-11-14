import Ajv from 'ajv';
import { DomainError } from '../domain-error.js';
import schema from './assembly-line-configuration.schema.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(schema);
const ERROR_PREFIX = 'Invalid Assembly Line Configuration Content';

function contentError(violations) {
  const error = new DomainError(`${ERROR_PREFIX}: ${violations.join(', ')}`);
  error.details = violations;
  return error;
}

export function isValidAssetReference(reference) {
  if (typeof reference !== 'string' || reference.trim().length === 0) return false;
  if (reference.startsWith('//')) return false;
  if (reference.startsWith('/')) return true;
  try {
    const { protocol } = new URL(reference);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const TEXTURE_PROPERTIES = ['roughnessMap', 'bumpMap', 'normalMap'];

export function validateAssemblyLineConfigurationContent(content) {
  // Schema validation
  const isValid = validateSchema(content);
  if (!isValid) {
    const violations = validateSchema.errors.map((error) =>
      `${error.instancePath || error.dataPath || 'root'} ${error.message}`.trim(),
    );
    throw contentError(violations);
  }
  // Domain rules
  const violations = [];
  const elementIds = new Set();
  for (const [index, element] of content.elements.entries()) {
    // Unique element ids
    if (elementIds.has(element.id)) {
      violations.push(`/elements/${index}/id duplicate element id '${element.id}'`);
    }
    elementIds.add(element.id);
    // Asset references
    // modelReference is optional: without it the element is procedural (VIS03).
    if (element.modelReference !== undefined && !isValidAssetReference(element.modelReference)) {
      violations.push(
        `/elements/${index}/modelReference must be an absolute http(s) URL or a root-relative path`,
      );
    }
    for (const property of TEXTURE_PROPERTIES) {
      const reference = element.material?.[property];
      if (reference !== undefined && !isValidAssetReference(reference)) {
        violations.push(
          `/elements/${index}/material/${property} must be an absolute http(s) URL or a root-relative path`,
        );
      }
    }
  }
  if (violations.length > 0) throw contentError(violations);
  return content;
}

/**
 * Factory for a new Assembly Line Configuration. The line has no active state: it is
 * placed in the kitchen by the kitchen configuration that references it.
 */
export function createAssemblyLineConfigurationData(name, content) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new DomainError(
      'Invalid Assembly Line Configuration: Name is required and cannot be empty.',
    );
  }
  const validContent = validateAssemblyLineConfigurationContent(content);
  return {
    name: name.trim(),
    content: validContent,
  };
}
