import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

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

export default function KitchenScene({ config }) {
  if (!config || !config.content || !config.content.dimensions) return null;

  const dimensions = config.content.dimensions;
  const elements = config.content.elements || [];

  const safeWidth = Number(dimensions.width) || 10;
  const safeLength = Number(dimensions.length) || 10;
  const safeHeight = Number(dimensions.height) || 5;

  const degToRad = (degrees) => (Number(degrees) || 0) * (Math.PI / 180);

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
        {elements.map((element, index) => {
          if (
            !element ||
            !element.position ||
            !element.scale ||
            !element.rotation
          )
            return null;

          const pos = [
            Number(element.position.x) || 0,
            Number(element.position.y) || 0,
            Number(element.position.z) || 0,
          ];
          const rot = [
            degToRad(element.rotation.x),
            degToRad(element.rotation.y),
            degToRad(element.rotation.z),
          ];
          const scl = [
            Number(element.scale.x) || 1,
            Number(element.scale.y) || 1,
            Number(element.scale.z) || 1,
          ];

          // 1. FORNO DE PEDRA PROCEDURAL (US2)
          if (element.type === 'equipment') {
            return (
              <group key={element.id} position={pos} rotation={rot} scale={scl}>
                {/* Base de pedra */}
                <mesh position={[0, 0.5, 0]}>
                  <boxGeometry args={[2, 1, 2]} />
                  <meshStandardMaterial color="#696969" />
                </mesh>
                {/* Cúpula de pedra (Dome) */}
                <mesh position={[0, 1, 0]}>
                  <sphereGeometry
                    args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
                  />
                  <meshStandardMaterial color="#A9A9A9" />
                </mesh>
              </group>
            );
          }

          // 2. CORREIA TRANSPORTADORA PROCEDURAL (US3)
          if (element.type === 'assembly-line') {
            return (
              <group key={element.id} position={pos} rotation={rot} scale={scl}>
                {/* Base metálica da estrutura */}
                <mesh position={[0, -0.2, 0]}>
                  <boxGeometry args={[1, 0.4, 0.8]} />
                  <meshStandardMaterial color="#708090" />{' '}
                  {/* Cinzento metálico */}
                </mesh>
                {/* Tapete rolante */}
                <mesh position={[0, 0.05, 0]}>
                  <boxGeometry args={[1, 0.1, 0.9]} />
                  <meshStandardMaterial color="#1C1C1C" />{' '}
                  {/* Borracha escura */}
                </mesh>
              </group>
            );
          }

          // 3. FALLBACK SEGURO
          return (
            <mesh
              key={element.id || `fallback-id-${index}`}
              position={pos}
              rotation={rot}
              scale={scl}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color={element.material?.color || '#c8231a'}
              />
            </mesh>
          );
        })}
      </Suspense>
    </Canvas>
  );
}
