/**
 * Example assembly line with the VIS03 arrangement, used as the default content of a new
 * line. Same content as the back-end fixture valid-vis03-line.json.
 *
 * Local coordinates (metres): x along the line (left -> right), y up, z from the wall
 * towards the kitchen. Counter top at y = 0.9; crust platform and overhead dispenser on
 * the left, conveyor belt in the middle (length = scale.x), robotic arms behind the belt,
 * wood-fired oven on the right. No modelReference: every component is procedural.
 *
 * VIS04: each component has its own textured material (Poly Haven, CC0), served from
 * public/textures/<slug>/{diffuse,normal,rough}.jpg.
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
      material: {
        colorMap: '/textures/blue_metal_plate/diffuse.jpg',
        normalMap: '/textures/blue_metal_plate/normal.jpg',
        roughnessMap: '/textures/blue_metal_plate/rough.jpg',
        metalness: 0.6,
        repeat: {
          x: 6,
          y: 1,
        },
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
      material: {
        colorMap: '/textures/wood_table_001/diffuse.jpg',
        normalMap: '/textures/wood_table_001/normal.jpg',
        roughnessMap: '/textures/wood_table_001/rough.jpg',
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
      material: {
        colorMap: '/textures/metal_plate/diffuse.jpg',
        normalMap: '/textures/metal_plate/normal.jpg',
        roughnessMap: '/textures/metal_plate/rough.jpg',
        metalness: 0.7,
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
      material: {
        colorMap: '/textures/rubber_tiles/diffuse.jpg',
        normalMap: '/textures/rubber_tiles/normal.jpg',
        roughnessMap: '/textures/rubber_tiles/rough.jpg',
        repeat: {
          x: 8,
          y: 1,
        },
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
      material: {
        colorMap: '/textures/polystyrene/diffuse.jpg',
        normalMap: '/textures/polystyrene/normal.jpg',
        roughnessMap: '/textures/polystyrene/rough.jpg',
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
      material: {
        colorMap: '/textures/polystyrene/diffuse.jpg',
        normalMap: '/textures/polystyrene/normal.jpg',
        roughnessMap: '/textures/polystyrene/rough.jpg',
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
      material: {
        colorMap: '/textures/polystyrene/diffuse.jpg',
        normalMap: '/textures/polystyrene/normal.jpg',
        roughnessMap: '/textures/polystyrene/rough.jpg',
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
      material: {
        colorMap: '/textures/polystyrene/diffuse.jpg',
        normalMap: '/textures/polystyrene/normal.jpg',
        roughnessMap: '/textures/polystyrene/rough.jpg',
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
      material: {
        colorMap: '/textures/red_brick/diffuse.jpg',
        normalMap: '/textures/red_brick/normal.jpg',
        roughnessMap: '/textures/red_brick/rough.jpg',
        repeat: {
          x: 2,
          y: 1,
        },
      },
    },
  ],
};
