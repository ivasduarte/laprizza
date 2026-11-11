import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export default function KitchenScene({ config }) {
  console.log('Configuração ativa carregada no motor 3D:', config);

  // Extracts the JSON data that comes from the API
  const dimensions = config?.content?.dimensions;
  if (!dimensions) return null;

  const elements = config?.content?.elements || [];
  // Convert degrees to radians
  const degToRad = (degrees) => degrees * (Math.PI / 180);

  return (
    // Camera positioning according to kitchen size
    <Canvas
      camera={{
        position: [0, dimensions.height * 2, dimensions.length],
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
      <gridHelper args={[Math.max(dimensions.width, dimensions.length), 20]} />
      <axesHelper args={[5]} />

      {/* Kitchen floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[dimensions.width, dimensions.length]} />
        <meshStandardMaterial color="#e6d5bd" />
      </mesh>

      {}
      {elements.map((element, index) => {
        const posX = Number(element?.position?.x) || 0;
        const posY = Number(element?.position?.y) || 0;
        const posZ = Number(element?.position?.z) || 0;

        const rotX = degToRad(element?.rotation?.x);
        const rotY = degToRad(element?.rotation?.y);
        const rotZ = degToRad(element?.rotation?.z);

        const scaleX = Number(element?.scale?.x) || 1;
        const scaleY = Number(element?.scale?.y) || 1;
        const scaleZ = Number(element?.scale?.z) || 1;

        return (
          <mesh
            key={element?.id || `fallback-id-${index}`}
            position={[posX, posY, posZ]}
            rotation={[rotX, rotY, rotZ]}
            scale={[scaleX, scaleY, scaleZ]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={element?.material?.color || '#c8231a'}
            />
          </mesh>
        );
      })}
    </Canvas>
  );
}