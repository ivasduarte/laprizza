import { Canvas } from '@react-three/fiber';

export default function KitchenScene() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '600px',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      {/* Canvas initializes the Three.js engine, the camera, and the rendering loop. */}
      <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
        {/* Define the background color of the 3D world (using the LaPrizza CSS text color). */}
        <color attach="background" args={['#2a1512']} />

        {/* Basic light to help us see 3D shapes in the future. */}
        <ambientLight intensity={0.5} />

        {/* Temporary test cube to confirm that WebGL is rendering */}
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshBasicMaterial color="#c8231a" />
        </mesh>
      </Canvas>
    </div>
  );
}
