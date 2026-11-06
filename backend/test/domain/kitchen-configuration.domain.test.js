import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../../src/domain/domain-error.js';
import {
  validateKitchenConfigurationContent,
  createKitchenConfigurationData,
} from '../../src/domain/kitchen-configuration/kitchen-configuration.domain.js';

import validStandardLayout from './fixtures/kitchen-configurations/valid-standard-layout.json' with { type: 'json' };
import validAutomatedLine from './fixtures/kitchen-configurations/valid-automated-line.json' with { type: 'json' };
import invalidMissingDimensions from './fixtures/kitchen-configurations/invalid-missing-dimensions.json' with { type: 'json' };
import invalidNegativeScale from './fixtures/kitchen-configurations/invalid-negative-scale.json' with { type: 'json' };
import invalidDuplicateIds from './fixtures/kitchen-configurations/invalid-duplicate-ids.json' with { type: 'json' };

test('validateKitchenConfigurationContent accepts valid configurations', () => {
  assert.doesNotThrow(() => validateKitchenConfigurationContent(validStandardLayout));
  assert.doesNotThrow(() => validateKitchenConfigurationContent(validAutomatedLine));
});

test('validateKitchenConfigurationContent rejects missing required properties', () => {
  assert.throws(
    () => validateKitchenConfigurationContent(invalidMissingDimensions),
    (err) => {
      assert.ok(err instanceof DomainError);
      // Verifica a presença das palavras-chave em vez da frase exata do AJV
      assert.ok(err.message.includes('dimensions'));
      assert.ok(err.message.includes('required') || err.message.includes('must have'));
      return true;
    },
  );
});

test('validateKitchenConfigurationContent rejects negative scales (schema validation)', () => {
  assert.throws(
    () => validateKitchenConfigurationContent(invalidNegativeScale),
    (err) => {
      assert.ok(err instanceof DomainError);
      // Garantimos apenas que o erro menciona 'scale', independentemente da formatação do AJV
      assert.ok(err.message.includes('scale'));
      return true;
    },
  );
});

test('validateKitchenConfigurationContent rejects duplicate element IDs (domain validation)', () => {
  assert.throws(
    () => validateKitchenConfigurationContent(invalidDuplicateIds),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(err.message.includes("/elements/1/id duplicate element id 'duplicate-id-01'"));
      return true;
    },
  );
});

test('createKitchenConfigurationData creates the aggregate with normalized data', () => {
  const data = createKitchenConfigurationData('  Main Kitchen ', validStandardLayout, true);

  assert.equal(data.name, 'Main Kitchen');
  assert.equal(data.isActive, true);
  assert.deepEqual(data.content, validStandardLayout);
});

test('createKitchenConfigurationData rejects missing or blank names', () => {
  const invalidNames = ['', '   ', null, undefined, 123];

  for (const name of invalidNames) {
    assert.throws(
      () => createKitchenConfigurationData(name, validStandardLayout),
      (err) => {
        assert.ok(err instanceof DomainError);
        assert.ok(err.message.includes('Name is required and cannot be empty'));
        return true;
      },
    );
  }
});
