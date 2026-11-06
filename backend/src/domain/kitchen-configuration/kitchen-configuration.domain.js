import Ajv from 'ajv';
import { DomainError } from '../domain-error.js';
import schema from './kitchen-configuration.schema.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(schema);

/**
 * Validates the parsed JSON content against the schema and domain business rules.
 * @param {Object} content - The parsed JSON configuration.
 * @returns {Object} The validated content.
 * @throws {DomainError} If schema or business rule validations fail.
 */
export function validateKitchenConfigurationContent(content) {
  // 1. Schema Validation (Structure, Types, Required Fields, Negative Scales)
  const isValid = validateSchema(content);
  if (!isValid) {
    const errors = validateSchema.errors.map(
      (err) => `${err.instancePath || err.dataPath || 'root'} ${err.message}`.trim(),
    );
    throw new DomainError(`Invalid Kitchen Configuration Content: ${errors.join(', ')}`);
  }

  // 2. Domain Rule: Unique Element IDs
  const elementIds = new Set();
  for (const [index, element] of content.elements.entries()) {
    if (elementIds.has(element.id)) {
      throw new DomainError(
        `Invalid Kitchen Configuration Content: /elements/${index}/id duplicate element id '${element.id}'`,
      );
    }
    elementIds.add(element.id);
  }

  // 3. Domain Rule: Asset Reference sanity checks (optional deep validation if needed beyond schema's uri-reference)
  for (const [index, element] of content.elements.entries()) {
    if (element.modelReference && !element.modelReference.startsWith('/')) {
      throw new DomainError(
        `Invalid Kitchen Configuration Content: /elements/${index}/modelReference must be an absolute path`,
      );
    }
  }

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