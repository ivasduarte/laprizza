import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aiViolations,
  toErrorMap,
  toFieldPath,
} from '../../src/features/ai/shared/ai-errors.js';
import { normalizeError } from '../../src/shared/api/error-normalizer.js';

describe('WEB07 API validation errors', () => {
  it('normalizes bracket paths of the business rules to the dot paths of Joi', () => {
    assert.equal(toFieldPath('entries[2].sizeId'), 'entries.2.sizeId');
    assert.equal(
      toFieldPath('products[0].offers[1].supplierId'),
      'products.0.offers.1.supplierId'
    );
    assert.equal(toFieldPath('entries.0.date'), 'entries.0.date');
  });

  it('prefixes business codes and keeps Joi types', () => {
    const normalized = normalizeError({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [
        { field: 'entries[0].productId', type: 'productUnknown', message: 'x' },
        {
          field: 'entries.1.quantity',
          type: 'number.min',
          limit: 0,
          message: 'y',
        },
      ],
    });
    const { fieldErrors } = aiViolations(normalized);
    assert.deepEqual(toErrorMap(fieldErrors), {
      'entries.0.productId': { type: 'ai.productUnknown' },
      'entries.1.quantity': { type: 'number.min', limit: 0 },
    });
  });
});
