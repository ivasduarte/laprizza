import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../../src/domain/domain-error.js';
import {
  validateAssemblyLineConfigurationContent,
  createAssemblyLineConfigurationData,
  isValidAssetReference,
} from '../../src/domain/assembly-line-configuration/assembly-line-configuration.domain.js';

import validStandardLine from './fixtures/assembly-line-configurations/valid-standard-line.json' with { type: 'json' };
import validFullLine from './fixtures/assembly-line-configurations/valid-full-line.json' with { type: 'json' };
import invalidMissingDimensions from './fixtures/assembly-line-configurations/invalid-missing-dimensions.json' with { type: 'json' };
import invalidNegativeScale from './fixtures/assembly-line-configurations/invalid-negative-scale.json' with { type: 'json' };
import invalidDuplicateIds from './fixtures/assembly-line-configurations/invalid-duplicate-ids.json' with { type: 'json' };
import validVis03Line from './fixtures/assembly-line-configurations/valid-vis03-line.json' with { type: 'json' };

test('validateAssemblyLineConfigurationContent accepts valid configurations', () => {
  assert.doesNotThrow(() => validateAssemblyLineConfigurationContent(validStandardLine));
  assert.doesNotThrow(() => validateAssemblyLineConfigurationContent(validFullLine));
});

test('validateAssemblyLineConfigurationContent accepts the VIS03 line (platform, dispenser, conveyor, arms, oven)', () => {
  assert.doesNotThrow(() => validateAssemblyLineConfigurationContent(validVis03Line));
});

test('validateAssemblyLineConfigurationContent accepts every VIS03 component type', () => {
  const vis03Types = [
    'counter',
    'receiving-platform',
    'crust-dispenser',
    'conveyor-belt',
    'robotic-arm',
    'wood-fired-oven',
  ];
  for (const type of vis03Types) {
    assert.doesNotThrow(() => validateAssemblyLineConfigurationContent(buildContent({ type })), type);
  }
});

test('validateAssemblyLineConfigurationContent rejects missing required properties', () => {
  assert.throws(
    () => validateAssemblyLineConfigurationContent(invalidMissingDimensions),
    (err) => {
      assert.ok(err instanceof DomainError);
      // Verifica a presença das palavras-chave em vez da frase exata do AJV
      assert.ok(err.message.includes('dimensions'));
      assert.ok(err.message.includes('required') || err.message.includes('must have'));
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent rejects negative scales (schema validation)', () => {
  assert.throws(
    () => validateAssemblyLineConfigurationContent(invalidNegativeScale),
    (err) => {
      assert.ok(err instanceof DomainError);
      // Garantimos apenas que o erro menciona 'scale', independentemente da formatação do AJV
      assert.ok(err.message.includes('scale'));
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent rejects an unknown element type (schema validation)', () => {
  const content = buildContent({ type: 'robot' });
  assert.throws(
    () => validateAssemblyLineConfigurationContent(content),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(err.message.includes('type'));
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent rejects duplicate element IDs (domain validation)', () => {
  assert.throws(
    () => validateAssemblyLineConfigurationContent(invalidDuplicateIds),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(err.message.includes("/elements/1/id duplicate element id 'duplicate-id-01'"));
      return true;
    },
  );
});

test('createAssemblyLineConfigurationData creates the aggregate with normalized data and no active state', () => {
  const data = createAssemblyLineConfigurationData('  Main Line ', validStandardLine);

  assert.deepEqual(data, { name: 'Main Line', content: validStandardLine });
});

test('createAssemblyLineConfigurationData rejects missing or blank names', () => {
  const invalidNames = ['', '   ', null, undefined, 123];

  for (const name of invalidNames) {
    assert.throws(
      () => createAssemblyLineConfigurationData(name, validStandardLine),
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

function buildContent(elementOverrides = {}) {
  return {
    dimensions: { width: 12, length: 30, height: 4 },
    elements: [
      {
        id: 'conveyor-01',
        type: 'assembly-line',
        modelReference: '/assets/models/conveyor.gltf',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        material: TEXTURED,
        ...elementOverrides,
      },
    ],
  };
}

test('isValidAssetReference accepts http(s) URLs and root-relative paths only', () => {
  const valid = [
    '/assets/conveyor.gltf',
    'https://cdn.laprizza.pt/conveyor.gltf',
    'http://localhost:3000/a.glb',
  ];
  const invalid = [
    'assets/conveyor.gltf',
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

test('validateAssemblyLineConfigurationContent accepts an absolute URL as modelReference', () => {
  const content = buildContent({ modelReference: 'https://cdn.laprizza.pt/models/conveyor.gltf' });
  assert.doesNotThrow(() => validateAssemblyLineConfigurationContent(content));
});

test('validateAssemblyLineConfigurationContent accepts a procedural element without modelReference', () => {
  const content = buildContent();
  delete content.elements[0].modelReference;
  assert.doesNotThrow(() => validateAssemblyLineConfigurationContent(content));
});

test('validateAssemblyLineConfigurationContent rejects an empty modelReference when present', () => {
  assert.throws(
    () => validateAssemblyLineConfigurationContent(buildContent({ modelReference: '' })),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(err.details.some((d) => d.startsWith('/elements/0/modelReference')));
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent rejects a relative modelReference and reports its path in details', () => {
  assert.throws(
    () =>
      validateAssemblyLineConfigurationContent(
        buildContent({ modelReference: 'models/conveyor.gltf' }),
      ),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.deepEqual(err.details, [
        '/elements/0/modelReference must be an absolute http(s) URL or a root-relative path',
      ]);
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent rejects invalid texture references', () => {
  const content = buildContent({
    material: { color: '#aabbcc', normalMap: 'javascript:alert(1)' },
  });
  assert.throws(
    () => validateAssemblyLineConfigurationContent(content),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(err.details.some((d) => d.startsWith('/elements/0/material/normalMap')));
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent checks every texture property', () => {
  const content = buildContent({
    material: {
      colorMap: '/textures/steel/diffuse.jpg',
      roughnessMap: 'data:x',
      bumpMap: 'relative.png',
      normalMap: '//evil/x.png',
    },
  });
  assert.throws(
    () => validateAssemblyLineConfigurationContent(content),
    (err) => {
      assert.equal(err.details.length, 3);
      for (const property of ['roughnessMap', 'bumpMap', 'normalMap']) {
        assert.ok(err.details.some((d) => d.startsWith(`/elements/0/material/${property}`)));
      }
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent reports every domain violation at once', () => {
  const content = buildContent();
  content.elements.push({ ...content.elements[0], modelReference: 'bad' });

  assert.throws(
    () => validateAssemblyLineConfigurationContent(content),
    (err) => {
      assert.equal(err.details.length, 2);
      assert.ok(err.details[0].startsWith("/elements/1/id duplicate element id 'conveyor-01'"));
      assert.ok(err.details[1].startsWith('/elements/1/modelReference'));
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent exposes schema violations in details', () => {
  assert.throws(
    () => validateAssemblyLineConfigurationContent({ elements: [] }),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(Array.isArray(err.details) && err.details.length > 0);
      return true;
    },
  );
});

// --- Textures and materials (VIS04) ---

test('validateAssemblyLineConfigurationContent accepts the VIS03 line with a textured material per element', () => {
  for (const element of validVis03Line.elements) {
    assert.ok(element.material?.colorMap, `${element.id} has a colour map`);
  }
  assert.doesNotThrow(() => validateAssemblyLineConfigurationContent(validVis03Line));
});

test('validateAssemblyLineConfigurationContent rejects a textured material without a colour map', () => {
  const content = buildContent({ material: { normalMap: '/textures/steel/normal.jpg' } });
  assert.throws(
    () => validateAssemblyLineConfigurationContent(content),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.deepEqual(err.details, [
        '/elements/0/material/colorMap is required when the material has texture maps',
      ]);
      return true;
    },
  );
});

test('validateAssemblyLineConfigurationContent rejects out-of-range material properties (schema)', () => {
  const invalidMaterials = [
    { roughness: 1.5 },
    { metalness: -0.1 },
    { repeat: { x: 0, y: 1 } },
    { colourMap: '/textures/typo.jpg' },
  ];
  for (const material of invalidMaterials) {
    assert.throws(
      () => validateAssemblyLineConfigurationContent(buildContent({ material })),
      (err) => err instanceof DomainError && err.message.includes('material'),
      JSON.stringify(material),
    );
  }
});

test('WEB04/VIS04: every line component needs a textured material', () => {
  const content = buildContent();
  delete content.elements[0].material;
  assert.throws(
    () => validateAssemblyLineConfigurationContent(content),
    (err) => err.details.some((d) => d.startsWith('/elements/0/material is required')),
  );
});

test('WEB04: line components stay inside the line footprint (z from 0 to length)', () => {
  // Line 12 x 30 x 4: x in [-6, 6], z in [0, 30], y in [0, 4].
  assert.throws(
    () => validateAssemblyLineConfigurationContent(buildContent({ position: { x: 0, y: 0, z: -1 } })),
    (err) => {
      assert.deepEqual(err.details, [
        '/elements/0/position/z must be between 0 and 30 (inside the assembly line)',
      ]);
      return true;
    },
  );
});
