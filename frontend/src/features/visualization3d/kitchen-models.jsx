import { Surface } from './scene-materials.jsx';

/**
 * Procedural kitchen furniture (VIS03/VIS04), chosen by the optional `model` of a kitchen
 * element (`decoration` or `tool`). Each model is built at its real size (`size`: the JSON
 * scale, in metres), so legs, handles and boards keep their thickness instead of being
 * stretched. Every model stands on y = 0 of its origin and its front faces +z: rotate the
 * element (rotation.y) to turn the front towards the room.
 *
 * Every mesh uses the element material (a loaded texture), so the whole model is textured.
 */

const COLORS = {
  body: '#d9d9d9',
  wood: '#7a5233',
  dark: '#333333',
};

/** Box mesh at `position` with real dimensions. */
function Part({ size, position, material, color = COLORS.body }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <Surface material={material} color={color} />
    </mesh>
  );
}

/** Steel work table: top, four legs and a lower shelf. */
export function WorkTableModel({ size, material }) {
  const [w, h, d] = size;
  const top = 0.05;
  const leg = 0.06;
  const lx = w / 2 - leg / 2 - 0.03;
  const lz = d / 2 - leg / 2 - 0.03;
  return (
    <group>
      <Part
        size={[w, top, d]}
        position={[0, h - top / 2, 0]}
        material={material}
      />
      {[
        [-lx, -lz],
        [lx, -lz],
        [-lx, lz],
        [lx, lz],
      ].map(([x, z]) => (
        <Part
          key={`${x}:${z}`}
          size={[leg, h - top, leg]}
          position={[x, (h - top) / 2, z]}
          material={material}
          color={COLORS.dark}
        />
      ))}
      <Part
        size={[w - 0.1, 0.03, d - 0.1]}
        position={[0, 0.18, 0]}
        material={material}
      />
    </group>
  );
}

/** Upright fridge: body, two doors on the front (+z) with vertical handles. */
export function FridgeModel({ size, material }) {
  const [w, h, d] = size;
  const doorDepth = 0.04;
  const gap = 0.02;
  const lowerH = h * 0.62;
  const upperH = h - lowerH - gap * 3;
  const doorZ = d / 2 + doorDepth / 2;
  const handleX = w / 2 - 0.08;
  return (
    <group>
      <Part
        size={[w, h, d - doorDepth]}
        position={[0, h / 2, -doorDepth / 2]}
        material={material}
      />
      {[
        { height: lowerH, y: gap + lowerH / 2 },
        { height: upperH, y: gap * 2 + lowerH + upperH / 2 },
      ].map((door) => (
        <group key={door.y}>
          <Part
            size={[w - gap * 2, door.height, doorDepth]}
            position={[0, door.y, doorZ - doorDepth]}
            material={material}
          />
          <Part
            size={[0.03, Math.min(0.5, door.height * 0.6), 0.04]}
            position={[handleX, door.y, doorZ + 0.01]}
            material={material}
            color={COLORS.dark}
          />
        </group>
      ))}
    </group>
  );
}

/** Open shelving unit: sides, back and evenly spaced boards with containers. */
export function ShelvesModel({ size, material }) {
  const [w, h, d] = size;
  const panel = 0.04;
  const boards = Math.max(2, Math.round(h / 0.45));
  const step = (h - panel) / boards;
  const jarCount = Math.max(1, Math.floor(w / 0.35));
  return (
    <group>
      {[-1, 1].map((side) => (
        <Part
          key={side}
          size={[panel, h, d]}
          position={[side * (w / 2 - panel / 2), h / 2, 0]}
          material={material}
          color={COLORS.wood}
        />
      ))}
      <Part
        size={[w, h, panel / 2]}
        position={[0, h / 2, -d / 2 + panel / 4]}
        material={material}
        color={COLORS.wood}
      />
      {Array.from({ length: boards + 1 }, (_, i) => (
        <group key={i} position={[0, panel / 2 + i * step, 0]}>
          <Part
            size={[w - panel * 2, panel, d - panel / 2]}
            position={[0, 0, panel / 4]}
            material={material}
            color={COLORS.wood}
          />
          {/* Containers on every board but the top one */}
          {i < boards &&
            Array.from({ length: jarCount }, (_, j) => (
              <mesh
                key={j}
                position={[
                  -w / 2 + (w / jarCount) * (j + 0.5),
                  panel / 2 + Math.min(0.14, step * 0.35),
                  0,
                ]}
              >
                <cylinderGeometry
                  args={[
                    Math.min(0.1, d * 0.3),
                    Math.min(0.1, d * 0.3),
                    Math.min(0.28, step * 0.7),
                    16,
                  ]}
                />
                <Surface material={material} color={COLORS.body} />
              </mesh>
            ))}
        </group>
      ))}
    </group>
  );
}

/** Base cabinet: plinth, body, overhanging top and doors with handles on the front (+z). */
export function CabinetModel({ size, material }) {
  const [w, h, d] = size;
  const top = 0.04;
  const plinth = 0.1;
  const doorDepth = 0.02;
  const doors = Math.max(1, Math.round(w / 0.6));
  const doorW = w / doors;
  const bodyH = h - top - plinth;
  return (
    <group>
      <Part
        size={[w - 0.06, plinth, d - 0.08]}
        position={[0, plinth / 2, -0.02]}
        material={material}
        color={COLORS.dark}
      />
      <Part
        size={[w, bodyH, d - doorDepth]}
        position={[0, plinth + bodyH / 2, -doorDepth / 2]}
        material={material}
      />
      <Part
        size={[w + 0.04, top, d + 0.04]}
        position={[0, h - top / 2, 0]}
        material={material}
      />
      {Array.from({ length: doors }, (_, i) => {
        const x = -w / 2 + doorW * (i + 0.5);
        return (
          <group key={i}>
            <Part
              size={[doorW - 0.02, bodyH - 0.04, doorDepth]}
              position={[x, plinth + bodyH / 2, d / 2 - doorDepth / 2]}
              material={material}
            />
            <Part
              size={[Math.min(0.2, doorW * 0.4), 0.02, 0.03]}
              position={[x, h - top - 0.08, d / 2 + 0.015]}
              material={material}
              color={COLORS.dark}
            />
          </group>
        );
      })}
    </group>
  );
}

/** Row of open ingredient bins, each filled to below the rim. */
export function IngredientBinsModel({ size, material }) {
  const [w, h, d] = size;
  const count = Math.max(1, Math.round(w / 0.25));
  const binW = w / count;
  const wall = 0.01;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const x = -w / 2 + binW * (i + 0.5);
        return (
          <group key={i} position={[x, 0, 0]}>
            <Part
              size={[binW - 0.01, wall, d]}
              position={[0, wall / 2, 0]}
              material={material}
            />
            {[-1, 1].map((side) => (
              <Part
                key={`x${side}`}
                size={[wall, h, d]}
                position={[side * (binW / 2 - 0.005 - wall / 2), h / 2, 0]}
                material={material}
              />
            ))}
            {[-1, 1].map((side) => (
              <Part
                key={`z${side}`}
                size={[binW - 0.01, h, wall]}
                position={[0, h / 2, side * (d / 2 - wall / 2)]}
                material={material}
              />
            ))}
            <Part
              size={[binW - 0.04, h * 0.6, d - 0.03]}
              position={[0, h * 0.3 + wall, 0]}
              material={material}
              color={COLORS.wood}
            />
          </group>
        );
      })}
    </group>
  );
}

/** Stack of trays with dough balls on the top tray. */
export function DoughTraysModel({ size, material }) {
  const [w, h, d] = size;
  const trays = Math.max(1, Math.round(h / 0.05));
  const trayH = h / trays;
  const cols = Math.max(1, Math.floor(w / 0.15));
  const rows = Math.max(1, Math.floor(d / 0.15));
  const ball = Math.min(0.05, (w / cols) * 0.35, (d / rows) * 0.35);
  return (
    <group>
      {Array.from({ length: trays }, (_, i) => (
        <Part
          key={i}
          size={[w, trayH * 0.8, d]}
          position={[0, trayH * (i + 0.4), 0]}
          material={material}
        />
      ))}
      {Array.from({ length: cols * rows }, (_, k) => {
        const c = k % cols;
        const r = Math.floor(k / cols);
        return (
          <mesh
            key={k}
            position={[
              -w / 2 + (w / cols) * (c + 0.5),
              h + ball * 0.6,
              -d / 2 + (d / rows) * (r + 0.5),
            ]}
            scale={[1, 0.6, 1]}
          >
            <sphereGeometry args={[ball, 16, 12]} />
            <Surface material={material} color={COLORS.body} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Kitchen element `model` values and their components. */
export const KITCHEN_MODELS = Object.freeze({
  'work-table': WorkTableModel,
  fridge: FridgeModel,
  shelves: ShelvesModel,
  cabinet: CabinetModel,
  'ingredient-bins': IngredientBinsModel,
  'dough-trays': DoughTraysModel,
});
