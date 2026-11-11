import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export default function KitchenScene({ config }) {
  console.log('Configuração ativa carregada no motor 3D:', config);

  // Extracts the JSON data that comes from the API
  const dimensions = config?.content?.dimensions;
  if (!dimensions) return null;

  //const elements = config?.content?.elements || [];
  // Convert degrees to radians
  // const degToRad = (degrees) => degrees * (Math.PI / 180);

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

      {/* Updated test cube to receive light */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#c8231a" />
      </mesh>
    </Canvas>
  );
}