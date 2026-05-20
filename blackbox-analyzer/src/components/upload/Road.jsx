import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Infinite scrolling road with lane markings and roadside lights.
 */
export default function Road({ speed = 1 }) {
  const markingsRef = useRef();
  const offset = useRef(0);

  useFrame((_, delta) => {
    offset.current = (offset.current + delta * speed * 6) % 4;
    if (markingsRef.current) {
      markingsRef.current.position.x = offset.current;
    }
  });

  const roadMat = new THREE.MeshStandardMaterial({
    color: '#111118',
    roughness: 0.9,
    metalness: 0.05,
  });

  const markingMat = new THREE.MeshStandardMaterial({
    color: '#f0e060',
    emissive: '#f0e060',
    emissiveIntensity: 0.3,
  });

  const shoulderMat = new THREE.MeshStandardMaterial({
    color: '#1a1a22',
    roughness: 1,
  });

  return (
    <group>
      {/* Road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.36, 0]} receiveShadow material={roadMat}>
        <planeGeometry args={[80, 8]} />
      </mesh>

      {/* Shoulder strips */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.355, 3.2]} material={shoulderMat}>
        <planeGeometry args={[80, 1.6]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.355, -3.2]} material={shoulderMat}>
        <planeGeometry args={[80, 1.6]} />
      </mesh>

      {/* Center dashes — scrolling group */}
      <group ref={markingsRef}>
        {Array.from({ length: 20 }).map((_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[-38 + i * 4, -0.35, 0]}
            material={markingMat}
          >
            <planeGeometry args={[1.8, 0.12]} />
          </mesh>
        ))}
      </group>

      {/* Edge lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 2.6]} material={new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.2 })}>
        <planeGeometry args={[80, 0.08]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, -2.6]} material={new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.2 })}>
        <planeGeometry args={[80, 0.08]} />
      </mesh>

      {/* Ground plane (dark) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.37, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0a0a0f" roughness={1} />
      </mesh>
    </group>
  );
}
