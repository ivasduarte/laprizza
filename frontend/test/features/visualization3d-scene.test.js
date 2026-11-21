import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_TEXTURE,
  TEXTURE_BY_MODEL,
  TEXTURE_BY_TYPE,
  WALL_TEXTURE,
  elementMaterial,
  floorMaterial,
  kitchenWalls,
} from '../../src/features/visualization3d/scene-textures.js';
import { isCameraPositionAllowed } from '../../src/features/visualization3d/camera-view.js';

const SCRIPT_TEXTURES = [
  'blue_metal_plate',
  'rubber_tiles',
  'wood_table_001',
  'metal_plate',
  'polystyrene',
  'red_brick',
  'rock_wall_08',
  'tiled_floor_001',
  'beige_wall_001',
  'dark_wood',
];

describe('scene textures (VIS04)', () => {
  it('keeps the JSON material when it has a colour map', () => {
    const material = { colorMap: '/textures/rock_wall_08/diffuse.jpg' };
    assert.equal(elementMaterial({ type: 'equipment', material }), material);
  });

  it('textures elements without a JSON colour map, keeping the JSON properties', () => {
    const spec = elementMaterial({
      type: 'robotic-arm',
      material: { roughness: 0.4 },
    });
    assert.equal(spec.colorMap, '/textures/polystyrene/diffuse.jpg');
    assert.ok(spec.normalMap && spec.roughnessMap);
    assert.equal(spec.roughness, 0.4);
    assert.equal(
      elementMaterial({ type: 'unknown' }).colorMap,
      `/textures/${FALLBACK_TEXTURE}/diffuse.jpg`
    );
  });

  it('uses the texture of the furniture model before the one of the type', () => {
    assert.equal(
      elementMaterial({ type: 'decoration', model: 'fridge' }).colorMap,
      '/textures/polystyrene/diffuse.jpg'
    );
  });

  it('textures the floor by default, sized from the kitchen', () => {
    const spec = floorMaterial(undefined, { width: 10, length: 15 });
    assert.equal(spec.colorMap, '/textures/tiled_floor_001/diffuse.jpg');
    assert.deepEqual(spec.repeat, { x: 6.67, y: 10 });
  });

  it('draws four textured walls as high as the kitchen, facing the room', () => {
    const walls = kitchenWalls({ width: 10, length: 15, height: 3 });
    assert.equal(walls.length, 4);
    for (const wall of walls) {
      assert.equal(wall.size[1], 3);
      assert.equal(wall.position[1], 1.5);
      assert.equal(
        wall.material.colorMap,
        `/textures/${WALL_TEXTURE}/diffuse.jpg`
      );
      // The plane normal (0, 0, 1) rotated by y must point to the room centre.
      const ry = wall.rotation[1];
      const normal = [Math.sin(ry), Math.cos(ry)];
      const toCentre = [-wall.position[0], -wall.position[2]];
      assert.ok(
        normal[0] * toCentre[0] + normal[1] * toCentre[1] > 0,
        wall.key
      );
    }
  });

  it('only uses textures downloaded by the download script', () => {
    for (const slug of [
      ...Object.values(TEXTURE_BY_TYPE),
      ...Object.values(TEXTURE_BY_MODEL),
      FALLBACK_TEXTURE,
      WALL_TEXTURE,
    ])
      assert.ok(SCRIPT_TEXTURES.includes(slug), slug);
  });
});

describe('camera obstacles (VIS07)', () => {
  const box = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 2, z: 1 } };

  it('rejects a position inside an object', () => {
    assert.equal(
      isCameraPositionAllowed({ x: 0.5, y: 1, z: 0.5 }, [box]),
      false
    );
  });

  it('accepts a position outside every object', () => {
    assert.equal(isCameraPositionAllowed({ x: 3, y: 1, z: 0.5 }, [box]), true);
    assert.equal(
      isCameraPositionAllowed({ x: 0.5, y: 2.5, z: 0.5 }, [box]),
      true
    );
  });

  it('rejects a position under the minimum height', () => {
    assert.equal(isCameraPositionAllowed({ x: 5, y: 0.1, z: 5 }, []), false);
  });
});
