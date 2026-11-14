/**
 * Example assembly line with the VIS03 arrangement, used as the default content of a new
 * line. Same content as the back-end fixture valid-vis03-line.json.
 *
 * Local coordinates (metres): x along the line (left -> right), y up, z from the wall
 * towards the kitchen. Counter top at y = 0.9; crust platform and overhead dispenser on
 * the left, conveyor belt in the middle (length = scale.x), robotic arms behind the belt,
 * wood-fired oven on the right. No modelReference: every component is procedural.
 */
export const DEFAULT_ASSEMBLY_LINE_CONTENT = {
  dimensions: {
    width: 9,
    length: 1.4,
    height: 2.6,
  },
  elements: [
    {
      id: 'counter-01',
      type: 'counter',
      position: {
        x: 0,
        y: 0,
        z: 0.7,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 9,
        y: 1,
        z: 1.2,
      },
    },
    {
      id: 'platform-01',
      type: 'receiving-platform',
      position: {
        x: -3.8,
        y: 0.9,
        z: 0.7,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    },
    {
      id: 'dispenser-01',
      type: 'crust-dispenser',
      position: {
        x: -3.8,
        y: 0.9,
        z: 0.7,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    },
    {
      id: 'conveyor-01',
      type: 'conveyor-belt',
      position: {
        x: 0,
        y: 0.9,
        z: 0.7,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 6.4,
        y: 1,
        z: 1,
      },
    },
    {
      id: 'arm-01',
      type: 'robotic-arm',
      position: {
        x: -2.2,
        y: 0.9,
        z: 0.15,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    },
    {
      id: 'arm-02',
      type: 'robotic-arm',
      position: {
        x: -0.8,
        y: 0.9,
        z: 0.15,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    },
    {
      id: 'arm-03',
      type: 'robotic-arm',
      position: {
        x: 0.6,
        y: 0.9,
        z: 0.15,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    },
    {
      id: 'arm-04',
      type: 'robotic-arm',
      position: {
        x: 2.0,
        y: 0.9,
        z: 0.15,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    },
    {
      id: 'oven-01',
      type: 'wood-fired-oven',
      position: {
        x: 3.9,
        y: 0.9,
        z: 0.7,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    },
  ],
};
