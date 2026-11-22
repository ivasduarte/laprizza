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

const TEXTURED = {
  colorMap: '/textures/metal_plate/diffuse.jpg',
  normalMap: '/textures/metal_plate/normal.jpg',
};

const buildContent = (elementOverrides = {}) => ({
  dimensions: { width: 10, length: 15, height: 3 },
  floor: { material: TEXTURED },
  elements: [
    {
      id: 'oven-01',
      type: 'equipment',
      modelReference: '/assets/models/oven.gltf',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      material: TEXTURED,
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

test('validateKitchenConfigurationContent accepts a procedural element without modelReference', () => {
  const content = buildContent();
  delete content.elements[0].modelReference;
  assert.doesNotThrow(() => validateKitchenConfigurationContent(content));
});

test('validateKitchenConfigurationContent rejects an empty modelReference when present', () => {
  assert.throws(
    () => validateKitchenConfigurationContent(buildContent({ modelReference: '' })),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(err.details.some((d) => d.startsWith('/elements/0/modelReference')));
      return true;
    },
  );
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

test('WEB04/VIS04: every object and the floor need textures (colorMap + detail map)', () => {
  const content = buildContent({ material: undefined });
  delete content.elements[0].material;
  content.floor = { material: { color: '#ffffff' } };
  content.elements.push({
    ...buildContent().elements[0],
    id: 'flat',
    material: { colorMap: '/t/c.jpg' },
  });

  assert.throws(
    () => validateKitchenConfigurationContent(content),
    (err) => {
      assert.ok(err.details.some((d) => d.startsWith('/elements/0/material is required')));
      assert.ok(err.details.some((d) => d.startsWith('/elements/1/material must include')));
      assert.ok(err.details.some((d) => d.startsWith('/floor/material must have textures')));
      return true;
    },
  );
});

test('WEB04: positions, sizes and the assembly line placement must be inside the kitchen', () => {
  // Kitchen 10 x 15 x 3, origin at the floor centre: x in [-5, 5], z in [-7.5, 7.5], y in [0, 3].
  const content = buildContent({
    position: { x: 5.5, y: -1, z: 0 },
    scale: { x: 11, y: 1, z: 1 },
  });
  content.assemblyLine = {
    configurationId: 'a'.repeat(24),
    position: { x: 0, y: 0, z: 8 },
    rotation: { x: 0, y: 0, z: 0 },
  };
  assert.throws(
    () => validateKitchenConfigurationContent(content),
    (err) => {
      assert.deepEqual(err.details, [
        '/elements/0/position/x must be between -5 and 5 (inside the kitchen)',
        '/elements/0/position/y must be between 0 and 3 (inside the kitchen)',
        '/elements/0/scale/x must be at most 10 (the size of the kitchen)',
        '/assemblyLine/position/z must be between -7.5 and 7.5 (inside the kitchen)',
      ]);
      return true;
    },
  );
  assert.doesNotThrow(() =>
    validateKitchenConfigurationContent(buildContent({ position: { x: -5, y: 3, z: 7.5 } })),
  );
});

test('kitchen furniture model (VIS03): known models are accepted, unknown ones rejected', () => {
  const content = (model) => ({
    dimensions: { width: 10, length: 15, height: 3 },
    floor: { material: TEXTURED }, // VIS04: every object is textured
    elements: [
      {
        id: 'fridge-01',
        type: 'decoration',
        model,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 90, z: 0 },
        scale: { x: 0.9, y: 2, z: 0.8 },
        material: TEXTURED,
      },
    ],
  });
  assert.doesNotThrow(() => validateKitchenConfigurationContent(content('fridge')));
  assert.throws(() => validateKitchenConfigurationContent(content('spaceship')), DomainError);
});
