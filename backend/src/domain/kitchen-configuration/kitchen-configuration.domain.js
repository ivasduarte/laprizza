import Ajv from 'ajv';
import { DomainError } from '../domain-error.js';
import schema from './kitchen-configuration.schema.json' with { type: 'json' };
import {
  collectRequiredTextureViolations,
  isValidAssetReference,
} from '../material/material.domain.js';
import {
  collectElementBoundsViolations,
  collectPlacementViolations,
  Frame,
} from '../spatial/bounds.domain.js';

// Kept as part of this module's API (used by existing callers and tests).
export { isValidAssetReference };

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

    // 2.2 Asset references (when present): absolute http(s) URL or root-relative path
    // modelReference is optional: without it the element is procedural (VIS03).
    if (element.modelReference !== undefined && !isValidAssetReference(element.modelReference)) {
      violations.push(
        `/elements/${index}/modelReference must be an absolute http(s) URL or a root-relative path`,
      );
    }

    // 2.3 Textures (VIS04/WEB04): every object is textured
    violations.push(
      ...collectRequiredTextureViolations(element.material, `/elements/${index}/material`),
    );
  }

  // 2.4 Floor textures (VIS04/WEB04)
  violations.push(...collectRequiredTextureViolations(content.floor?.material, '/floor/material'));

  // 2.5 Positions and sizes inside the kitchen (WEB04), assembly line placed inside it
  violations.push(
    ...collectElementBoundsViolations(content.elements, content.dimensions, Frame.KITCHEN),
  );
  if (content.assemblyLine) {
    violations.push(
      ...collectPlacementViolations(
        content.assemblyLine.position,
        content.dimensions,
        '/assemblyLine/position',
      ),
    );
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
