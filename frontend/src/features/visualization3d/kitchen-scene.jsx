import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export default function KitchenScene({ config }) {
  console.log('Configuração ativa carregada no motor 3D:', config);
  
  return (
    <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
      {/* Base background color */}
      <color attach="background" args={['#2a1512']} />

      {/* 1. Ambient and Focused Lighting */}
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[10, 15, 10]} intensity={1} castShadow />

      {/* 2. Mouse Controls */}
      {/* Targeting [0,0,0] ensures that we orbit around the center of the ground */}
      <OrbitControls target={[0, 0, 0]} makeDefault />

      {/* Temporary visual aids to help you build the kitchen (XYZ axes and grid on the floor) */}
      <axesHelper args={[5]} />
      <gridHelper args={[20, 20]} />

      {/* Updated test cube to receive light */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#c8231a" />
      </mesh>
    </Canvas>
  );
}