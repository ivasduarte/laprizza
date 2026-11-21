import { Surface } from './scene-materials.jsx';

/**
 * Procedural models of the automated pizza assembly line (VIS03).
 *
 * Line local axes: x runs along the line (left -> right), y is up, z grows from the wall
 * towards the kitchen. Every model stands on y = 0 of its own origin, so the JSON
 * position places its base (e.g. on the counter top, y = 0.9).
 *
 * `material` (VIS04) is the textured material of the element from the JSON, applied to every
 * part of the model (no untextured surface in the scene). The colours below are only used by
 * configurations stored before textures became mandatory.
 *
 * Parts that will be animated in Sprint 3 are named groups with their pivot at the
 * joint, so animating means rotating or moving that group:
 *   crust-dispenser: "crust-stack", "release"
 *   conveyor-belt:   "belt", "rollers"
 *   robotic-arm:     "base" -> "shoulder" -> "elbow" -> "wrist"
 */

const COLORS = {
  steel: '#8a9099',
  darkSteel: '#4a4f57',
  counterTop: '#9aa0a6',
  rubber: '#1f1f1f',
  slat: '#3a3a3a',
  platform: '#d2691e',
  crust: '#e3c48d',
  armWhite: '#f2f2f2',
  joint: '#e07b1f',
  jointDark: '#222222',
  terracotta: '#b5562c',
  ovenMouth: '#1a0d08',
  ovenBase: '#7a5a48',
};

/** Large counter under the line: unit footprint 1 x 1 (stretched by scale), 0.9 high. */
export function CounterModel({ material }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[1, 0.84, 1]} />
        <Surface material={material} color={COLORS.darkSteel} />
      </mesh>
      <mesh position={[0, 0.87, 0]}>
        <boxGeometry args={[1, 0.06, 1]} />
        <Surface material={material} color={COLORS.counterTop} />
      </mesh>
    </group>
  );
}

/** Rectangular receiving platform for the pre-formed crusts (left end of the line). */
export function ReceivingPlatformModel({ material }) {
  return (
    <mesh position={[0, 0.04, 0]}>
      <boxGeometry args={[1.2, 0.08, 1]} />
      <Surface material={material} color={COLORS.platform} />
    </mesh>
  );
}

const CRUST_COUNT = 10;
const DISPENSER_POSTS = [
  [-0.55, -0.45],
  [0.55, -0.45],
  [-0.55, 0.45],
  [0.55, 0.45],
];

/** Overhead system that supplies the crusts onto the receiving platform below it. */
export function CrustDispenserModel({ material }) {
  const shelfY = 1.5;
  return (
    <group>
      {DISPENSER_POSTS.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.85, z]}>
          <cylinderGeometry args={[0.03, 0.03, 1.7, 12]} />
          <Surface material={material} color={COLORS.steel} />
        </mesh>
      ))}
      <mesh position={[0, shelfY, 0]}>
        <boxGeometry args={[1.2, 0.05, 1]} />
        <Surface material={material} color={COLORS.darkSteel} />
      </mesh>
      <group name="crust-stack" position={[0, shelfY + 0.025, 0]}>
        {Array.from({ length: CRUST_COUNT }, (_, i) => (
          <mesh key={i} position={[0, 0.015 + i * 0.03, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.025, 32]} />
            <Surface material={material} color={COLORS.crust} />
          </mesh>
        ))}
      </group>
      {/* Chute under the shelf: drops one crust onto the platform (Sprint 3). */}
      <group name="release" position={[0, shelfY - 0.025, 0]}>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.38, 0.3, 0.2, 32]} />
          <Surface material={material} color={COLORS.steel} />
        </mesh>
      </group>
    </group>
  );
}

const SLAT_SPACING = 0.12;
const BELT_WIDTH = 0.6;

/**
 * Integrated conveyor belt connecting the platform to the oven. `length` is the JSON
 * scale.x: it lengthens the belt and adds slats instead of stretching them.
 */
export function ConveyorBeltModel({ length, material }) {
  const safeLength = Math.max(Number(length) || 1, 0.5);
  const slatCount = Math.max(1, Math.floor(safeLength / SLAT_SPACING));
  const firstSlatX = -((slatCount - 1) * SLAT_SPACING) / 2;
  return (
    <group>
      {/* Side frame */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.1, side * (BELT_WIDTH / 2 + 0.03)]}>
          <boxGeometry args={[safeLength, 0.16, 0.05]} />
          <Surface material={material} color={COLORS.steel} />
        </mesh>
      ))}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[safeLength, 0.08, BELT_WIDTH]} />
        <Surface material={material} color={COLORS.rubber} />
      </mesh>
      {/* Belt surface: slats move along +x in Sprint 3 */}
      <group name="belt" position={[0, 0.13, 0]}>
        {Array.from({ length: slatCount }, (_, i) => (
          <mesh key={i} position={[firstSlatX + i * SLAT_SPACING, 0, 0]}>
            <boxGeometry args={[0.05, 0.02, BELT_WIDTH - 0.02]} />
            <Surface material={material} color={COLORS.slat} />
          </mesh>
        ))}
      </group>
      {/* End rollers: rotate around z in Sprint 3 */}
      <group name="rollers">
        {[-1, 1].map((end) => (
          <mesh
            key={end}
            position={[end * (safeLength / 2), 0.08, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.07, 0.07, BELT_WIDTH, 16]} />
            <Surface material={material} color={COLORS.darkSteel} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Articulated robotic arm mounted behind the belt, reaching over it (+z) to deposit
 * ingredients. Hierarchy: base (yaw) -> shoulder -> elbow -> wrist, each pivot at its joint.
 */
export function RoboticArmModel({ material }) {
  return (
    <group name="base">
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.1, 24]} />
        <Surface material={material} color={COLORS.jointDark} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 16]} />
        <Surface material={material} color={COLORS.armWhite} />
      </mesh>

      <group name="shoulder" position={[0, 0.82, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.16, 20]} />
          <Surface material={material} color={COLORS.joint} />
        </mesh>
        <mesh position={[0, 0, 0.28]}>
          <boxGeometry args={[0.09, 0.09, 0.56]} />
          <Surface material={material} color={COLORS.armWhite} />
        </mesh>

        <group name="elbow" position={[0, 0, 0.56]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.065, 0.065, 0.13, 20]} />
            <Surface material={material} color={COLORS.jointDark} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <boxGeometry args={[0.07, 0.28, 0.07]} />
            <Surface material={material} color={COLORS.armWhite} />
          </mesh>

          <group name="wrist" position={[0, -0.28, 0]}>
            <mesh>
              <sphereGeometry args={[0.05, 16, 12]} />
              <Surface material={material} color={COLORS.joint} />
            </mesh>
            {/* Ingredient nozzle */}
            <mesh position={[0, -0.08, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.05, 0.12, 16]} />
              <Surface material={material} color={COLORS.jointDark} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Traditional wood-fired oven (right end), mouth facing the conveyor (-x). */
export function WoodFiredOvenModel({ material }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.3, 0.4, 1.3]} />
        <Surface material={material} color={COLORS.ovenBase} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Surface material={material} color={COLORS.terracotta} />
      </mesh>
      {/* Mouth, where the conveyor delivers the pizzas */}
      <mesh position={[-0.55, 0.58, 0]}>
        <boxGeometry args={[0.14, 0.3, 0.42]} />
        <Surface material={material} color={COLORS.ovenMouth} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0.15, 1.15, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.6, 16]} />
        <Surface material={material} color={COLORS.terracotta} />
      </mesh>
    </group>
  );
}
