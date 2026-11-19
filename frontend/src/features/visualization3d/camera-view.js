export const CAMERA_FOV = 50;

/** Initial polar angle: an elevated three-quarter view of the whole kitchen. */
export const INITIAL_POLAR_ANGLE = (55 * Math.PI) / 180;

/** Never completely vertical to avoid flips. */
export const MIN_POLAR_ANGLE = 0.1;
/** The orbit never makes a full turn. */
export const MAX_AZIMUTH_ANGLE = (3 * Math.PI) / 4;

export const CONTROL_SPEEDS = Object.freeze({
  rotateSpeed: 0.5,
  panSpeed: 0.6,
  zoomSpeed: 1.5,
  dampingFactor: 0.08,
});

const DEFAULT_DIMENSIONS = Object.freeze({ width: 10, length: 10, height: 5 });

const degToRad = (degrees) => (degrees * Math.PI) / 180;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const positiveOr = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

export function normalizeDimensions(dimensions) {
  return {
    width: positiveOr(dimensions?.width, DEFAULT_DIMENSIONS.width),
    length: positiveOr(dimensions?.length, DEFAULT_DIMENSIONS.length),
    height: positiveOr(dimensions?.height, DEFAULT_DIMENSIONS.height),
  };
}

export function floorCenter() {
  return { x: 0, y: 0, z: 0 };
}

/**
 * Largest polar angle for which the camera never sees above its own height.
 * It is also below 90º, so the camera always stays above the floor.
 */
export function maxPolarAngleForFov(fovDegrees = CAMERA_FOV) {
  return Math.PI / 2 - degToRad(fovDegrees) / 2;
}

/**
 * Initial view and limits, derived from kitchen dimensions.
 */
export function computeCameraSetup(dimensions, fovDegrees = CAMERA_FOV) {
  const { width, length, height } = normalizeDimensions(dimensions);
  const largestSide = Math.max(width, length);
  const boundingRadius = Math.hypot(width, length, height) / 2;
  const target = floorCenter();

  const maxPolarAngle = maxPolarAngleForFov(fovDegrees);
  const initialPolar = Math.min(INITIAL_POLAR_ANGLE, maxPolarAngle);

  const minDistance = Math.max(1, 0.1 * largestSide);
  const initialDistance = Math.max(
    minDistance,
    largestSide / 2 / Math.tan(degToRad(fovDegrees) / 2)
  );
  const maxDistance = 1.5 * initialDistance;
  const margin = 0.05 * largestSide;

  return {
    target,
    position: {
      x: target.x,
      y: target.y + initialDistance * Math.cos(initialPolar),
      z: target.z + initialDistance * Math.sin(initialPolar),
    },
    minDistance,
    maxDistance,
    minPolarAngle: MIN_POLAR_ANGLE,
    maxPolarAngle,
    minAzimuthAngle: -MAX_AZIMUTH_ANGLE,
    maxAzimuthAngle: MAX_AZIMUTH_ANGLE,
    near: clamp(minDistance / 20, 0.05, 0.5),
    far: maxDistance + 2 * boundingRadius + 2 * margin,
    panBounds: {
      minX: target.x - width / 2 - margin,
      maxX: target.x + width / 2 + margin,
      minZ: target.z - length / 2 - margin,
      maxZ: target.z + length / 2 + margin,
      y: target.y,
    },
  };
}

export function constrainPan(target, position, bounds) {
  const clamped = {
    x: clamp(target.x, bounds.minX, bounds.maxX),
    y: bounds.y,
    z: clamp(target.z, bounds.minZ, bounds.maxZ),
  };
  const dx = clamped.x - target.x;
  const dy = clamped.y - target.y;
  const dz = clamped.z - target.z;

  return {
    target: clamped,
    position: { x: position.x + dx, y: position.y + dy, z: position.z + dz },
    changed: dx !== 0 || dy !== 0 || dz !== 0,
  };
}
