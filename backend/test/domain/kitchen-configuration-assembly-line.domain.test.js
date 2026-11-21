import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../../src/domain/domain-error.js';
import { validateKitchenConfigurationContent } from '../../src/domain/kitchen-configuration/kitchen-configuration.domain.js';

// --- Assembly line placement (VIS03 / WEB06: resolvable back-end reference) ---

const buildKitchen = (assemblyLine) => ({
  dimensions: { width: 12, length: 30, height: 4 },
  floor: { material: { colorMap: '/textures/tiled_floor_001/diffuse.jpg', normalMap: '/textures/tiled_floor_001/normal.jpg' } },
  elements: [],
  ...(assemblyLine !== undefined && { assemblyLine }),
});

const validPlacement = {
  configurationId: '6650f1c2a9b3e4d5f6a7b8c9',
  position: { x: 0, y: 0, z: -14.5 },
  rotation: { x: 0, y: 0, z: 0 },
};

/** Copy of `object` without `key`. */
const omit = (object, key) =>
  Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));

const expectSchemaViolation = (content, pathFragment) =>
  assert.throws(
    () => validateKitchenConfigurationContent(content),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.ok(
        err.details.some((d) => d.includes(pathFragment)),
        `expected a violation mentioning '${pathFragment}', got ${JSON.stringify(err.details)}`,
      );
      return true;
    },
  );

test('validateKitchenConfigurationContent accepts a kitchen without an assembly line', () => {
  assert.doesNotThrow(() => validateKitchenConfigurationContent(buildKitchen()));
});

test('validateKitchenConfigurationContent accepts a valid assembly line placement', () => {
  assert.doesNotThrow(() => validateKitchenConfigurationContent(buildKitchen(validPlacement)));
});

test('validateKitchenConfigurationContent rejects a malformed assembly line configurationId', () => {
  expectSchemaViolation(
    buildKitchen({ ...validPlacement, configurationId: 'not-an-object-id' }),
    'configurationId',
  );
});

test('validateKitchenConfigurationContent rejects an assembly line placement without position', () => {
  expectSchemaViolation(buildKitchen(omit(validPlacement, 'position')), 'position');
});

test('validateKitchenConfigurationContent rejects an assembly line placement without rotation', () => {
  expectSchemaViolation(buildKitchen(omit(validPlacement, 'rotation')), 'rotation');
});

test('validateKitchenConfigurationContent rejects unknown properties in the assembly line placement', () => {
  expectSchemaViolation(buildKitchen({ ...validPlacement, isActive: true }), 'assemblyLine');
});

// --- Floor material (VIS04) ---

test('validateKitchenConfigurationContent accepts a textured floor', () => {
  const content = {
    ...buildKitchen(),
    floor: {
      material: {
        colorMap: '/textures/tiled_floor_001/diffuse.jpg',
        normalMap: '/textures/tiled_floor_001/normal.jpg',
        roughnessMap: '/textures/tiled_floor_001/rough.jpg',
        repeat: { x: 6, y: 10 },
      },
    },
  };
  assert.doesNotThrow(() => validateKitchenConfigurationContent(content));
});

test('validateKitchenConfigurationContent reports floor material violations with their path', () => {
  const content = {
    ...buildKitchen(),
    floor: { material: { colorMap: '/textures/tiled_floor_001/diffuse.jpg' } },
  };
  assert.throws(
    () => validateKitchenConfigurationContent(content),
    (err) => {
      assert.ok(err instanceof DomainError);
      assert.deepEqual(err.details, [
        '/floor/material must include a roughnessMap, bumpMap or normalMap with the colorMap',
      ]);
      return true;
    },
  );
});

test('validateKitchenConfigurationContent rejects unknown floor properties', () => {
  expectSchemaViolation({ ...buildKitchen(), floor: { colour: '#ffffff' } }, 'floor');
});

