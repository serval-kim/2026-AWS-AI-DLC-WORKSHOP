import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Monochrome night environment — grey stars, grey streetlights */
export default function Environment() {
  const starsRef = useRef();

  useFrame((_, delta) => {
    if (starsRef.current) starsRef.current.rotation.y += delta * 0.001;
  });

  const starPositions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 400; i++) {
      arr.push(
        (Math.random() - 0.5) * 300,
        12 + Math.random() * 50,
        (Math.random() - 0.5) * 300,
      );
    }
    return new Float32Array(arr);
  }, []);

  const poleMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#222222', metalness: 0.5, roughness: 0.5 }), []);
  const lampMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dddddd', emissive: '#dddddd', emissiveIntensity: 1.5 }), []);
  const skyMat   = useMemo(() => new THREE.MeshBasicMaterial({ color: '#050505', side: THREE.BackSide }), []);

  return (
    <group>
      {/* Sky dome */}
      <mesh material={skyMat}>
        <sphereGeometry args={[180, 32, 16]} />
      </mesh>

      {/* Stars — grey/white */}
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#cccccc" size={0.07} sizeAttenuation transparent opacity={0.6} />
      </points>

      {/* Subtle ambient fill from above */}
      <pointLight position={[0, 20, 0]} color="#aaaaaa" intensity={0.5} distance={60} decay={2} />

      {/* Streetlights — right side of road */}
      {[-30, -18, -6, 6, 18, 30].map((x, i) => (
        <group key={`r${i}`} position={[x, 0, 3.6]}>
          <mesh material={poleMat} castShadow>
            <cylinderGeometry args={[0.045, 0.065, 5.0, 8]} />
          </mesh>
          {/* Arm */}
          <mesh material={poleMat} position={[-0.55, 2.3, -0.55]} rotation={[0, 0, 0.28]}>
            <cylinderGeometry args={[0.028, 0.028, 1.2, 6]} />
          </mesh>
          {/* Lamp housing */}
          <mesh material={lampMat} position={[-1.0, 2.5, -0.55]}>
            <boxGeometry args={[0.32, 0.14, 0.20]} />
          </mesh>
          <pointLight
            position={[-1.0, 2.3, -0.55]}
            color="#cccccc"
            intensity={4}
            distance={12}
            decay={2}
          />
        </group>
      ))}

      {/* Streetlights — left side */}
      {[-24, -12, 0, 12, 24].map((x, i) => (
        <group key={`l${i}`} position={[x, 0, -3.6]}>
          <mesh material={poleMat} castShadow>
            <cylinderGeometry args={[0.045, 0.065, 5.0, 8]} />
          </mesh>
          <mesh material={poleMat} position={[0.55, 2.3, 0.55]} rotation={[0, 0, -0.28]}>
            <cylinderGeometry args={[0.028, 0.028, 1.2, 6]} />
          </mesh>
          <mesh material={lampMat} position={[1.0, 2.5, 0.55]}>
            <boxGeometry args={[0.32, 0.14, 0.20]} />
          </mesh>
          <pointLight
            position={[1.0, 2.3, 0.55]}
            color="#bbbbbb"
            intensity={3}
            distance={10}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}
