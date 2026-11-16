/**
 * Material rules shared by every configuration that describes 3D objects
 * (kitchen and assembly line). VIS04: textures and material properties come from
 * the back end as JSON; asset references follow ADR-0021.
 */

/** Texture maps a material can reference. */
export const TEXTURE_MAPS = ['colorMap', 'roughnessMap', 'bumpMap', 'normalMap'];

/** VIS04: a textured material needs a colour map and one of these. */
const SURFACE_DETAIL_MAPS = ['roughnessMap', 'bumpMap', 'normalMap'];

/**
 * An asset reference is either an absolute http(s) URL (e.g. served by an asset host/CDN)
 * or a root-relative path (e.g. '/textures/red_brick/diffuse.jpg'). Protocol-relative
 * ('//host/x'), other schemes (javascript:, data:, file:) and bare relative paths are rejected.
 * @param {unknown} reference
 * @returns {boolean}
 */
export function isValidAssetReference(reference) {
  if (typeof reference !== 'string' || reference.trim().length === 0) return false;
  if (reference.startsWith('//')) return false;
  if (reference.startsWith('/')) return true;
  try {
    const { protocol } = new URL(reference);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Domain violations of a material (its structure is checked by the JSON schema).
 * - every texture map present must be a valid asset reference;
 * - a material with texture maps must include a colour map and at least one of the
 *   roughness, bump or normal maps (VIS04).
 * @param {object | undefined} material
 * @param {string} path - Property path of the material, e.g. '/elements/0/material'.
 * @returns {string[]} Violations, each prefixed by its property path.
 */
export function collectMaterialViolations(material, path) {
  if (!material) return [];
  const violations = [];

  for (const map of TEXTURE_MAPS) {
    const reference = material[map];
    if (reference !== undefined && !isValidAssetReference(reference)) {
      violations.push(`${path}/${map} must be an absolute http(s) URL or a root-relative path`);
    }
  }

  const hasTextures = TEXTURE_MAPS.some((map) => material[map] !== undefined);
  if (hasTextures) {
    if (material.colorMap === undefined) {
      violations.push(`${path}/colorMap is required when the material has texture maps`);
    }
    if (!SURFACE_DETAIL_MAPS.some((map) => material[map] !== undefined)) {
      violations.push(`${path} must include a roughnessMap, bumpMap or normalMap with the colorMap`);
    }
  }

  return violations;
}
