/**
 * WEB04: objects of a configuration must stay inside the space that contains them.
 *
 * Coordinate frames (metres, y up):
 * - kitchen: origin at the centre of the floor -> x in [-width/2, width/2],
 *   z in [-length/2, length/2], y in [0, height];
 * - assembly line: origin at the left-centre of its back edge -> x in [-width/2, width/2],
 *   z in [0, length] (from the wall towards the kitchen), y in [0, height].
 *
 * Elements are modelled at unit size, so a scale is a size in metres and may not exceed the
 * matching dimension (x <= width, y <= height, z <= length).
 */

export const Frame = Object.freeze({ KITCHEN: 'kitchen', LINE: 'line' });

const round = (value) => Math.round(value * 1000) / 1000;

/** Allowed range of each axis for a frame. */
export function axisRanges({ width, length, height }, frame) {
  return {
    x: [-width / 2, width / 2],
    y: [0, height],
    z: frame === Frame.LINE ? [0, length] : [-length / 2, length / 2],
  };
}

function outside(point, ranges, path, where) {
  const violations = [];
  for (const axis of ['x', 'y', 'z']) {
    const [min, max] = ranges[axis];
    const value = point?.[axis];
    if (typeof value === 'number' && (value < min || value > max)) {
      violations.push(
        `${path}/${axis} must be between ${round(min)} and ${round(max)} (inside the ${where})`,
      );
    }
  }
  return violations;
}

/**
 * Position and size violations of the elements of a configuration.
 *
 * @param {Array<{position: object, scale: object}>} elements
 * @param {{width: number, length: number, height: number}} dimensions
 * @param {'kitchen'|'line'} frame
 * @returns {string[]} Violations prefixed by their JSON path (e.g. /elements/2/position/x).
 */
export function collectElementBoundsViolations(elements, dimensions, frame) {
  const ranges = axisRanges(dimensions, frame);
  const where = frame === Frame.LINE ? 'assembly line' : 'kitchen';
  const limits = { x: dimensions.width, y: dimensions.height, z: dimensions.length };
  const violations = [];

  elements.forEach((element, index) => {
    violations.push(...outside(element.position, ranges, `/elements/${index}/position`, where));
    for (const axis of ['x', 'y', 'z']) {
      const value = element.scale?.[axis];
      if (typeof value === 'number' && value > limits[axis]) {
        violations.push(
          `/elements/${index}/scale/${axis} must be at most ${round(limits[axis])} (the size of the ${where})`,
        );
      }
    }
  });
  return violations;
}

/** The point where the assembly line is placed must be inside the kitchen. */
export function collectPlacementViolations(position, dimensions, path) {
  return outside(position, axisRanges(dimensions, Frame.KITCHEN), path, 'kitchen');
}
