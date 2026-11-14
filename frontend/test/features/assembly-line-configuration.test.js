import test from 'node:test';
import assert from 'node:assert/strict';
import { getAssemblyLineErrorKey } from '../../src/features/assembly-line-configuration/assembly-line-configuration-errors.js';
import {
  NO_LINE,
  applyAssemblyLineSelection,
  defaultPlacement,
  readSelectedLineId,
} from '../../src/features/assembly-line-configuration/assembly-line-placement.js';

const LINE_ID = '6650f1c2a9b3e4d5f6a7b8c9';
const OTHER_LINE_ID = '6650f1c2a9b3e4d5f6a7b8d0';

const kitchenText = (extra = {}) =>
  JSON.stringify({
    dimensions: { width: 10, length: 15, height: 3 },
    elements: [{ id: 'stone-oven-01', type: 'equipment' }],
    ...extra,
  });

// --- getAssemblyLineErrorKey ---

test('getAssemblyLineErrorKey maps each API status to its translation key', () => {
  assert.equal(
    getAssemblyLineErrorKey({ status: 400 }),
    'assemblyLine.errors.invalid'
  );
  assert.equal(
    getAssemblyLineErrorKey({ status: 404 }),
    'assemblyLine.errors.notFound'
  );
  assert.equal(
    getAssemblyLineErrorKey({ status: 409 }),
    'assemblyLine.errors.referenced'
  );
  assert.equal(
    getAssemblyLineErrorKey({ status: 500 }),
    'assemblyLine.errors.default'
  );
});

test('getAssemblyLineErrorKey falls back to the default key without a status', () => {
  assert.equal(getAssemblyLineErrorKey(null), 'assemblyLine.errors.default');
  assert.equal(
    getAssemblyLineErrorKey(undefined),
    'assemblyLine.errors.default'
  );
  assert.equal(
    getAssemblyLineErrorKey(new Error('network')),
    'assemblyLine.errors.default'
  );
});

// --- readSelectedLineId ---

test('readSelectedLineId returns the referenced line id', () => {
  const text = kitchenText({ assemblyLine: { configurationId: LINE_ID } });
  assert.equal(readSelectedLineId(text), LINE_ID);
});

test('readSelectedLineId returns NO_LINE when the kitchen has no assembly line', () => {
  assert.equal(readSelectedLineId(kitchenText()), NO_LINE);
});

test('readSelectedLineId returns null for invalid JSON', () => {
  assert.equal(readSelectedLineId('{ "dimensions": '), null);
});

// --- defaultPlacement ---

test('defaultPlacement puts the line against the back wall, centred', () => {
  assert.deepEqual(defaultPlacement({ dimensions: { length: 15 } }), {
    position: { x: 0, y: 0, z: -7.5 },
    rotation: { x: 0, y: 0, z: 0 },
  });
});

test('defaultPlacement falls back to the origin without dimensions', () => {
  assert.deepEqual(defaultPlacement({}).position, { x: 0, y: 0, z: 0 });
});

// --- applyAssemblyLineSelection ---

test('applyAssemblyLineSelection places a new line on the back wall', () => {
  const result = JSON.parse(applyAssemblyLineSelection(kitchenText(), LINE_ID));

  assert.deepEqual(result.assemblyLine, {
    configurationId: LINE_ID,
    position: { x: 0, y: 0, z: -7.5 },
    rotation: { x: 0, y: 0, z: 0 },
  });
});

test('applyAssemblyLineSelection keeps the kitchen dimensions and elements', () => {
  const result = JSON.parse(applyAssemblyLineSelection(kitchenText(), LINE_ID));

  assert.deepEqual(result.dimensions, { width: 10, length: 15, height: 3 });
  assert.deepEqual(result.elements, [
    { id: 'stone-oven-01', type: 'equipment' },
  ]);
});

test('applyAssemblyLineSelection keeps a manual position and rotation when the line changes', () => {
  const leftWall = {
    configurationId: LINE_ID,
    position: { x: -5, y: 0, z: 0 },
    rotation: { x: 0, y: 90, z: 0 },
  };
  const result = JSON.parse(
    applyAssemblyLineSelection(
      kitchenText({ assemblyLine: leftWall }),
      OTHER_LINE_ID
    )
  );

  assert.deepEqual(result.assemblyLine, {
    ...leftWall,
    configurationId: OTHER_LINE_ID,
  });
});

test('applyAssemblyLineSelection removes the placement when no line is chosen', () => {
  const text = kitchenText({ assemblyLine: { configurationId: LINE_ID } });
  const result = JSON.parse(applyAssemblyLineSelection(text, NO_LINE));

  assert.equal(Object.hasOwn(result, 'assemblyLine'), false);
});

test('applyAssemblyLineSelection throws on invalid JSON so the form can report it', () => {
  assert.throws(
    () => applyAssemblyLineSelection('{ "dimensions": ', LINE_ID),
    SyntaxError
  );
});
