/**
 * Textures of the 3D viewer (VIS04). Every object of the scene is drawn with a loaded
 * image texture (colour map plus normal and roughness maps) from public/textures
 * (Poly Haven, CC0; downloaded by scripts/download-polyhaven-textures.mjs).
 *
 * The material in the configuration JSON always wins. These textures are only used
 * for what the JSON does not texture: an element or floor without `colorMap`, and the
 * kitchen walls (the configuration has no walls).
 */

/** Texture of each element type, used when its JSON material has no `colorMap`. */
export const TEXTURE_BY_TYPE = Object.freeze({
  counter: 'blue_metal_plate',
  'receiving-platform': 'wood_table_001',
  'crust-dispenser': 'metal_plate',
  'conveyor-belt': 'rubber_tiles',
  'robotic-arm': 'polystyrene',
  'wood-fired-oven': 'red_brick',
  equipment: 'rock_wall_08',
  'assembly-line': 'rubber_tiles',
});

/** Texture of each kitchen furniture `model`, used when the JSON material has no `colorMap`. */
export const TEXTURE_BY_MODEL = Object.freeze({
  'work-table': 'metal_plate',
  fridge: 'polystyrene',
  shelves: 'dark_wood',
  cabinet: 'dark_wood',
  'ingredient-bins': 'metal_plate',
  'dough-trays': 'wood_table_001',
});

/** Texture of any other element type. */
export const FALLBACK_TEXTURE = 'metal_plate';

export const FLOOR_TEXTURE = 'tiled_floor_001';
export const WALL_TEXTURE = 'beige_wall_001';

/** Real size (metres) of one repetition of the floor and wall textures. */
const FLOOR_TILE = 1.5;
const WALL_TILE = 3; // beige_wall_001 is a 3 m tall scan

const round2 = (value) => Math.round(value * 100) / 100;

/** Material spec with the three maps of a texture in public/textures/<slug>/. */
export function textureMaterial(slug, repeat) {
  return {
    colorMap: `/textures/${slug}/diffuse.jpg`,
    normalMap: `/textures/${slug}/normal.jpg`,
    roughnessMap: `/textures/${slug}/rough.jpg`,
    ...(repeat ? { repeat } : {}),
  };
}

/**
 * The JSON material when it has a colour map; otherwise the texture of `slug`, keeping
 * the JSON properties (roughness, metalness, repeat...) when there is a JSON material.
 */
export function withTexture(spec, slug, repeat) {
  if (spec?.colorMap) return spec;
  return { ...textureMaterial(slug, repeat), ...(spec ?? {}) };
}

/** Material of a configuration element (kitchen or assembly line). */
export function elementMaterial(element) {
  return withTexture(
    element?.material,
    TEXTURE_BY_MODEL[element?.model] ??
      TEXTURE_BY_TYPE[element?.type] ??
      FALLBACK_TEXTURE
  );
}

/** Material of the kitchen floor: one texture repetition every FLOOR_TILE metres. */
export function floorMaterial(floorSpec, { width, length }) {
  return withTexture(floorSpec, FLOOR_TEXTURE, {
    x: round2(width / FLOOR_TILE),
    y: round2(length / FLOOR_TILE),
  });
}

/**
 * The four kitchen walls, as high as the kitchen, along the floor edges. Each plane faces
 * the inside of the room (rotation y), so the wall between the camera and the room is
 * not drawn and the kitchen is seen like a dollhouse.
 */
export function kitchenWalls({ width, length, height }) {
  const wall = (key, size, position, rotationY) => ({
    key,
    size: [size, height],
    position,
    rotation: [0, rotationY, 0],
    material: textureMaterial(WALL_TEXTURE, {
      x: round2(size / WALL_TILE),
      y: round2(height / WALL_TILE),
    }),
  });
  const y = height / 2;
  return [
    wall('back', width, [0, y, -length / 2], 0),
    wall('front', width, [0, y, length / 2], Math.PI),
    wall('left', length, [-width / 2, y, 0], Math.PI / 2),
    wall('right', length, [width / 2, y, 0], -Math.PI / 2),
  ];
}
