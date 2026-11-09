import Ajv from 'ajv';
import { DomainError } from '../domain-error.js';
import schema from './kitchen-configuration.schema.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(schema);

const ERROR_PREFIX = 'Invalid Kitchen Configuration Content';

/**
 * Creates a DomainError that keeps the individual violations (each one with its
 * property path) in `details`, so the API can return them to the client.
 * @param {string[]} violations - Human-readable violations, each prefixed by its property path.
 * @returns {DomainError}
 */
function contentError(violations) {
  const error = new DomainError(`${ERROR_PREFIX}: ${violations.join(', ')}`);
  error.details = violations;
  return error;
}

/**
 * An asset reference is either an absolute http(s) URL (e.g. served by an asset host/CDN)
 * or a root-relative path (e.g. '/assets/models/oven.gltf'). Protocol-relative ('//host/x'),
 * other schemes (javascript:, data:, file:) and bare relative paths are rejected.
 * @param {unknown} reference
 * @returns {boolean}
 */
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

/**
 * Validates the parsed JSON content against the schema and domain business rules.
 * @param {Object} content - The parsed JSON configuration.
 * @returns {Object} The validated content.
 * @throws {DomainError} If schema or business rule validations fail (`details` lists every violation).
 */
export function validateKitchenConfigurationContent(content) {
  // 1. Schema validation (structure, types, required fields, non-positive dimensions/scales)
  const isValid = validateSchema(content);
  if (!isValid) {
    const violations = validateSchema.errors.map((err) =>
      `${err.instancePath || err.dataPath || 'root'} ${err.message}`.trim(),
    );
    throw contentError(violations);
  }

  // 2. Domain rules (collected, so the client receives every violation at once)
  const violations = [];
  const elementIds = new Set();

  for (const [index, element] of content.elements.entries()) {
    // 2.1 Unique element ids
    if (elementIds.has(element.id)) {
      violations.push(`/elements/${index}/id duplicate element id '${element.id}'`);
    }
    elementIds.add(element.id);

    // 2.2 Asset references: absolute http(s) URL or root-relative path
    if (!isValidAssetReference(element.modelReference)) {
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
 * Factory function to create a new Kitchen Configuration aggregate.
 * @param {string} name - The descriptive name of the configuration.
 * @param {Object} content - The parsed JSON content.
 * @param {boolean} [isActive=false] - The activation status.
 * @returns {Object} The created aggregate data.
 */
export function createKitchenConfigurationData(name, content, isActive = false) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new DomainError('Invalid Kitchen Configuration: Name is required and cannot be empty.');
  }

  const validContent = validateKitchenConfigurationContent(content);

  return {
    name: name.trim(),
    content: validContent,
    isActive: Boolean(isActive),
  };
}