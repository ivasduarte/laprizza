import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import {
  CounterModel,
  ReceivingPlatformModel,
  CrustDispenserModel,
  ConveyorBeltModel,
  RoboticArmModel,
  WoodFiredOvenModel,
} from './assembly-line-models.jsx';

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

const VIS03_MODELS = {
  counter: CounterModel,
  'receiving-platform': ReceivingPlatformModel,
  'crust-dispenser': CrustDispenserModel,
  'robotic-arm': RoboticArmModel,
  'wood-fired-oven': WoodFiredOvenModel,
};

/**
 * One configuration element (kitchen or assembly line). Transforms are relative to the
 * parent: the kitchen origin, or the line origin for assembly line elements.
 */
function SceneElement({ element }) {
  if (!element || !element.position || !element.scale || !element.rotation)
    return null;

  const pos = toPosition(element.position);
  const rot = toRotation(element.rotation);
  const scl = toScale(element.scale);

  // VIS03 assembly line components. The group is named after the element id so that
  // Sprint 3 can find each component (and its named parts) to animate it.
  const Vis03Model = VIS03_MODELS[element.type];
  if (Vis03Model) {
    return (
      <group name={element.id} position={pos} rotation={rot} scale={scl}>
        <Vis03Model />
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
        <ConveyorBeltModel length={scl[0]} />
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
          <meshStandardMaterial color="#696969" />
        </mesh>
        {/* Cúpula de pedra (Dome) */}
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#A9A9A9" />
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
          <meshStandardMaterial color="#1C1C1C" />
        </mesh>
      </group>
    );
  }

  // 3. FALLBACK SEGURO
  return (
    <mesh position={pos} rotation={rot} scale={scl}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={element.material?.color || '#c8231a'} />
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

  return (
    // Camera positioning according to kitchen size
    <Canvas
      camera={{
        position: [0, safeHeight * 2, safeLength],
        fov: 50,
      }}
    >
      {/* Base background color */}
      <color attach="background" args={['#2a1512']} />

      {/* 1. Ambient and Focused Lighting */}
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[10, 15, 10]} intensity={1} castShadow />

      {/* 2. Mouse Controls */}
      {/* Targeting [0,0,0] ensures that we orbit around the center of the ground */}
      <OrbitControls target={[0, 0, 0]} makeDefault />

      {/* Helper grid to match the floor size for easier debugging */}
      <gridHelper args={[Math.max(safeWidth, safeLength), 20]} />
      <axesHelper args={[5]} />

      {/* Kitchen floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[safeWidth, safeLength]} />
        <meshStandardMaterial color="#e6d5bd" />
      </mesh>

      <Suspense
        fallback={
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="yellow" wireframe />
          </mesh>
        }
      >
        {elements.map((element, index) => (
          <SceneElement
            key={element?.id || `fallback-id-${index}`}
            element={element}
          />
        ))}

        {assemblyLine && <AssemblyLine line={assemblyLine} />}
      </Suspense>
    </Canvas>
  );
}
