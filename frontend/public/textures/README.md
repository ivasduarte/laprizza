# Textures (VIS04)

PBR textures used by the 3D kitchen and assembly line viewer. All of them come from
[Poly Haven](https://polyhaven.com) and are licensed **CC0** (public domain,
<https://polyhaven.com/license>): free to use for any purpose, without attribution.
We credit them anyway.

Each folder holds the 1k JPG maps of one texture:

- `diffuse.jpg`: colour map (`colorMap` in the configuration JSON)
- `normal.jpg`: normal map, OpenGL convention (`normalMap`)
- `rough.jpg`: roughness map (`roughnessMap`)

| Folder             | Poly Haven asset                                             | Used for             |
| ------------------ | ------------------------------------------------------------ | -------------------- |
| `blue_metal_plate` | [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) | Counter              |
| `rubber_tiles`     | [Rubber Tiles](https://polyhaven.com/a/rubber_tiles)         | Conveyor belt        |
| `wood_table_001`   | [Wood Table 001](https://polyhaven.com/a/wood_table_001)     | Receiving platform   |
| `metal_plate`      | [Metal Plate](https://polyhaven.com/a/metal_plate)           | Crust dispenser      |
| `polystyrene`      | [Polystyrene](https://polyhaven.com/a/polystyrene)           | Robotic arms         |
| `red_brick`        | [Red Brick](https://polyhaven.com/a/red_brick)               | Wood-fired oven      |
| `rock_wall_08`     | [Rock Wall 08](https://polyhaven.com/a/rock_wall_08)         | Stone oven (kitchen) |
| `tiled_floor_001`  | [Tiled Floor 001](https://polyhaven.com/a/tiled_floor_001)   | Kitchen floor        |
| `beige_wall_001`   | [Beige Wall 001](https://polyhaven.com/a/beige_wall_001)     | Kitchen walls        |
| `dark_wood`        | [Dark Wood](https://polyhaven.com/a/dark_wood)               | Cabinets, shelves    |

Objects whose JSON material has no `colorMap` (and the kitchen walls) use the texture of
their type, so every object is drawn with a texture (`src/features/visualization3d/scene-textures.js`).

To download or restore them: `node scripts/download-polyhaven-textures.mjs`
(files already present are kept).
