import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Streetlights + distant city glow + stars */
export default function Environment() {
  const starsRef = useRef();

  useFrame((_, delta) => {
    // very slow star drift
    if (starsRef.current) starsRef.current.rotation.y += delta * 0.002;
  });

  // Star positions
  const starPositions = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 300; i++) {
      arr.push(
        (Math.random() - 0.5) * 200,
        10 + Math.random() * 40,
        (Math.random() - 0.5) * 200,
      );
    }
    return new Float32Array(arr);
  }, []);

  return (
    <group>
      {/* Stars */}
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#aaccff" size={0.08} sizeAttenuation transparent opacity={0.7} />
      </points>

      {/* Ambient sky gradient — large sphere */}
      <mesh>
        <sphereGeometry args={[120, 32, 16]} />
        <meshBasicMaterial color="#050810" side={THREE.BackSide} />
      </mesh>

      {/* Distant city glow on horizon */}
      <pointLight position={[40, 2, -30]} color="#ff6600" intensity={2} distance={60} decay={2} />
      <pointLight position={[-30, 2, -30]} color="#4466ff" intensity={1.5} distance={50} decay={2} />

      {/* Streetlights along road */}
      {[-24, -12, 0, 12, 24].map((x, i) => (
        <group key={i} position={[x, 0, 3.8]}>
          {/* Pole */}
          <mesh>
            <cylinderGeometry args={[0.04, 0.06, 4.5, 8]} />
            <meshStandardMaterial color="#333344" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Arm */}
          <mesh position={[-0.5, 2.1, -0.5]} rotation={[0, 0, 0.3]}>
            <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
            <meshStandardMaterial color="#333344" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Lamp */}
          <mesh position={[-0.9, 2.3, -0.5]}>
            <boxGeometry args={[0.3, 0.12, 0.18]} />
            <meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[-0.9, 2.1, -0.5]} color="#ffe8a0" intensity={3} distance={10} decay={2} />
        </group>
      ))}

      {/* Opposite side streetlights */}
      {[-18, -6, 6, 18].map((x, i) => (
        <group key={i} position={[x, 0, -3.8]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.06, 4.5, 8]} />
            <meshStandardMaterial color="#333344" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0.5, 2.1, 0.5]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.025, 0.025, 1.1, 6]} />
            <meshStandardMaterial color="#333344" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0.9, 2.3, 0.5]}>
            <boxGeometry args={[0.3, 0.12, 0.18]} />
            <meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[0.9, 2.1, 0.5]} color="#ffe8a0" intensity={2} distance={8} decay={2} />
        </group>
      ))}
    </group>
  );
}
