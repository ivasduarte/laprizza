import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../../src/domain/domain-error.js';
import {
  validateKitchenConfigurationContent,
  createKitchenConfigurationData,
  isValidAssetReference,
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

// --- Asset reference rules (ADR-0021: absolute http(s) URL or root-relative path) ---

const buildContent = (elementOverrides = {}) => ({
  dimensions: { width: 10, length: 15, height: 3 },
  elements: [
    {
      id: 'oven-01',
      type: 'equipment',
      modelReference: '/assets/models/oven.gltf',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ...elementOverrides,
    },
  ],
});

test('isValidAssetReference accepts http(s) URLs and root-relative paths only', () => {
  const valid = [
    '/assets/oven.gltf',
    'https://cdn.laprizza.pt/oven.gltf',
    'http://localhost:3000/a.glb',
  ];
  const invalid = [
    'assets/oven.gltf',
    '//evil.example/x.gltf',
    'javascript:alert(1)',
    'data:text/plain,x',
    'file:///etc/passwd',
    '',
    '   ',
    null,
    undefined,
    42,
  ];

  for (const ref of valid) assert.equal(isValidAssetReference(ref), true, ref);
  for (const ref of invalid) assert.equal(isValidAssetReference(ref), false, String(ref));
});

test('validateKitchenConfigurationContent accepts an absolute URL as modelReference', () => {
  const content = buildContent({ modelReference: 'https://cdn.laprizza.pt/models/oven.gltf' });
  assert.doesNotThrow(() => validateKitchenConfigurationContent(content));
});

test('validateKitchenConfigurationContent rejects a relative modelReference and reports its path in details', () => {
  assert.throws(
    () => validateKitchenConfigurationContent(buildContent({ modelReference: 'models/oven.gltf' })),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.deepEqual(err.details, [
        '/elements/0/modelReference must be an absolute http(s) URL or a root-relative path',
      ]);
      return true;
    },
  );
});

test('validateKitchenConfigurationContent rejects invalid texture references', () => {
  const content = buildContent({
    material: { color: '#aabbcc', normalMap: 'javascript:alert(1)' },
  });
  assert.throws(
    () => validateKitchenConfigurationContent(content),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(err.details.some((d) => d.startsWith('/elements/0/material/normalMap')));
      return true;
    },
  );
});

test('validateKitchenConfigurationContent reports every domain violation at once', () => {
  const content = buildContent();
  content.elements.push({ ...content.elements[0], modelReference: 'bad' });

  assert.throws(
    () => validateKitchenConfigurationContent(content),
    (err) => {
      assert.equal(err.details.length, 2);
      assert.ok(err.details[0].startsWith("/elements/1/id duplicate element id 'oven-01'"));
      assert.ok(err.details[1].startsWith('/elements/1/modelReference'));
      return true;
    },
  );
});

test('validateKitchenConfigurationContent exposes schema violations in details', () => {
  assert.throws(
    () => validateKitchenConfigurationContent({ elements: [] }),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(Array.isArray(err.details) && err.details.length > 0);
      return true;
    },
  );
});