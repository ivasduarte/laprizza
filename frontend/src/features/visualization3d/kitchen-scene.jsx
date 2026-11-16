import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Object3D } from 'three';
import {
  CounterModel,
  ReceivingPlatformModel,
  CrustDispenserModel,
  ConveyorBeltModel,
  RoboticArmModel,
  WoodFiredOvenModel,
} from './assembly-line-models.jsx';
import { Surface, WithMaterial } from './scene-materials.jsx';

function Model({ url, position, rotation, scale }) {
  const { scene } = useGLTF(url);

  return (
    <primitive
      object={scene.clone()}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

const degToRad = (degrees) => (Number(degrees) || 0) * (Math.PI / 180);

const toPosition = (v) => [
  Number(v?.x) || 0,
  Number(v?.y) || 0,
  Number(v?.z) || 0,
];
const toRotation = (v) => [degToRad(v?.x), degToRad(v?.y), degToRad(v?.z)];
const toScale = (v) => [
  Number(v?.x) || 1,
  Number(v?.y) || 1,
  Number(v?.z) || 1,
];

/** Colour of a JSON material that sets properties but no colour. */
const DEFAULT_SURFACE_COLOR = '#c8c8c8';

const VIS03_MODELS = {
  counter: CounterModel,
  'receiving-platform': ReceivingPlatformModel,
  'crust-dispenser': CrustDispenserModel,
  'robotic-arm': RoboticArmModel,
  'wood-fired-oven': WoodFiredOvenModel,
};

/**
 * VIS05: scene lighting. Fixed in world space and derived only from the kitchen
 * dimensions (nothing comes from the JSON), so the look does not depend on the camera,
 * zoom or angle.
 * - ambient + hemisphere: base visibility from any angle (no pitch-black faces);
 * - directional "sun" (shadows): volume and contours for the whole kitchen;
 * - spotlight (shadows) above the kitchen: focal light and extra depth.
 */
function SceneLighting({ width, length, height, lineFocus }) {
  const spotTarget = useMemo(() => new Object3D(), []);
  const lineTarget = useMemo(() => new Object3D(), []);
  const half = Math.max(width, length) * 0.75; // shadow frustum fitted to the room

  // Light-to-origin distance plus half the floor diagonal, so corners are never cut.
  const sunPos = [width * 0.6, height * 3, length * 0.6];
  const sunFar = Math.hypot(...sunPos) + Math.hypot(width, length) / 2 + 1;

  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#ffffff', '#3a2a22', 0.45]} />

      <directionalLight
        position={sunPos}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={0.5}
        shadow-camera-far={sunFar}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />

      <primitive object={spotTarget} position={[0, 0, 0]} />
      <spotLight
        position={[0, height * 0.95, length * 0.25]}
        target={spotTarget}
        angle={Math.PI / 3}
        penumbra={0.6}
        intensity={3}
        decay={0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />

      {/* Second spotlight, over the assembly line (fixed, softer, no extra shadows) */}
      <primitive object={lineTarget} position={lineFocus} />
      <spotLight
        position={[lineFocus[0], height * 0.95, lineFocus[2] + 1]}
        target={lineTarget}
        angle={Math.PI / 3}
        penumbra={0.7}
        intensity={2}
        decay={0}
      />
    </>
  );
}

/**
 * Makes every mesh of the group cast/receive shadows. Checked periodically because
 * meshes can be remounted when textures finish loading (VIS04).
 */
function ShadowGroup({ children }) {
  const ref = useRef();
  const frame = useRef(0);

  useFrame(() => {
    if (frame.current++ % 30 !== 0 || !ref.current) return;
    ref.current.traverse((o) => {
      if (o.isMesh && !o.userData.shadowsSet) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.shadowsSet = true;
      }
    });
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * One configuration element (kitchen or assembly line). Transforms are relative to the
 * parent: the kitchen origin, or the line origin for assembly line elements.
 */
function SceneElement({ element }) {
  if (!element || !element.position || !element.scale || !element.rotation)
    return null;

  // VIS04: material from the JSON; without one the models keep their default colours.
  return (
    <WithMaterial spec={element.material} fallbackColor={DEFAULT_SURFACE_COLOR}>
      {(material) => (
        <SceneElementModel element={element} material={material} />
      )}
    </WithMaterial>
  );
}

function SceneElementModel({ element, material }) {
  const pos = toPosition(element.position);
  const rot = toRotation(element.rotation);
  const scl = toScale(element.scale);

  // VIS03 assembly line components. The group is named after the element id so that
  // Sprint 3 can find each component (and its named parts) to animate it.
  const Vis03Model = VIS03_MODELS[element.type];
  if (Vis03Model) {
    return (
      <group name={element.id} position={pos} rotation={rot} scale={scl}>
        <Vis03Model material={material} />
      </group>
    );
  }

  // The conveyor length comes from scale.x: slats are added, not stretched.
  if (element.type === 'conveyor-belt') {
    return (
      <group
        name={element.id}
        position={pos}
        rotation={rot}
        scale={[1, scl[1], scl[2]]}
      >
        <ConveyorBeltModel length={scl[0]} material={material} />
      </group>
    );
  }

  // 1. FORNO DE PEDRA PROCEDURAL (US2)
  if (element.type === 'equipment') {
    return (
      <group position={pos} rotation={rot} scale={scl}>
        {/* Base de pedra */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[2, 1, 2]} />
          <Surface material={material} color="#696969" />
        </mesh>
        {/* Cúpula de pedra (Dome) */}
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Surface material={material} color="#A9A9A9" />
        </mesh>
      </group>
    );
  }

  // 2. CORREIA TRANSPORTADORA PROCEDURAL (US3)
  if (element.type === 'assembly-line') {
    return (
      <group position={pos} rotation={rot} scale={scl}>
        {/* Base metálica da estrutura (cinzento metálico) */}
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[1, 0.4, 0.8]} />
          <meshStandardMaterial color="#708090" />
        </mesh>
        {/* Tapete rolante (borracha escura) */}
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[1, 0.1, 0.9]} />
          <Surface material={material} color="#1C1C1C" />
        </mesh>
      </group>
    );
  }

  // 3. FALLBACK SEGURO
  return (
    <mesh position={pos} rotation={rot} scale={scl}>
      <boxGeometry args={[1, 1, 1]} />
      <Surface material={material} color="#c8231a" />
    </mesh>
  );
}

/**
 * Assembly line (VIS03) placed in the kitchen by `content.assemblyLine`: a group at the
 * placement position/rotation (degrees, like the elements), with the line elements in
 * the line's local coordinates. Named so Sprint 3 animations can find it in the scene.
 */
function AssemblyLine({ line }) {
  const elements = line.content?.elements || [];
  return (
    <group
      name={`assembly-line-${line.id}`}
      position={toPosition(line.placement?.position)}
      rotation={toRotation(line.placement?.rotation)}
    >
      {elements.map((element, index) => (
        <SceneElement
          key={element?.id || `line-element-${index}`}
          element={element}
        />
      ))}
    </group>
  );
}

export default function KitchenScene({ config, assemblyLine }) {
  if (!config || !config.content || !config.content.dimensions) return null;

  const dimensions = config.content.dimensions;
  const elements = config.content.elements || [];

  const safeWidth = Number(dimensions.width) || 10;
  const safeLength = Number(dimensions.length) || 10;
  const safeHeight = Number(dimensions.height) || 5;

  // Fixed focus of the line spotlight: the assembly line placement (room center if none).
  const lineFocus = toPosition(assemblyLine?.placement?.position);

  // The initial camera must always be inside the zoom limits.
  const initialDistance = Math.hypot(safeHeight * 2, safeLength);
  const maxDistance = Math.max(
    initialDistance * 1.5,
    Math.max(safeWidth, safeLength) * 2
  );

  return (
    // Camera positioning according to kitchen size
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        position: [0, safeHeight * 2, safeLength],
        fov: 50,
      }}
    >
      {/* Base background color */}
      <color attach="background" args={['#2a1512']} />

      {/* VIS05: fixed scene lighting */}
      <SceneLighting
        width={safeWidth}
        length={safeLength}
        height={safeHeight}
        lineFocus={lineFocus}
      />

      {/* Mouse controls: orbit around the center of the ground, camera kept above the floor */}
      <OrbitControls
        target={[0, 0, 0]}
        makeDefault
        minDistance={2}
        maxDistance={maxDistance}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />

      {/* Kitchen floor (VIS04: optional material in content.floor) */}
      <WithMaterial
        spec={config.content.floor?.material}
        fallbackColor="#e6d5bd"
      >
        {(material) => (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[safeWidth, safeLength]} />
            <Surface material={material} color="#e6d5bd" />
          </mesh>
        )}
      </WithMaterial>

      <Suspense
        fallback={
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="yellow" wireframe />
          </mesh>
        }
      >
        <ShadowGroup>
          {elements.map((element, index) => (
            <SceneElement
              key={element?.id || `fallback-id-${index}`}
              element={element}
            />
          ))}

          {assemblyLine && <AssemblyLine line={assemblyLine} />}
        </ShadowGroup>
      </Suspense>
    </Canvas>
  );
}
