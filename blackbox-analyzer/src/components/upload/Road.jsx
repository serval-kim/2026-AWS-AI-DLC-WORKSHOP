import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Monochrome infinite road */
export default function Road({ speed = 1 }) {
  const markingsRef = useRef();
  const offset = useRef(0);

  useFrame((_, delta) => {
    if (speed > 0) {
      offset.current = (offset.current + delta * speed * 7) % 4;
      if (markingsRef.current) {
        markingsRef.current.position.x = offset.current;
      }
    }
  });

  const roadMat     = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.95, metalness: 0.0 }), []);
  const shoulderMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 1.0 }), []);
  const markingMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#888888', emissive: '#888888', emissiveIntensity: 0.15 }), []);
  const edgeMat     = useMemo(() => new THREE.MeshStandardMaterial({ color: '#aaaaaa', emissive: '#aaaaaa', emissiveIntensity: 0.2 }), []);
  const groundMat   = useMemo(() => new THREE.MeshStandardMaterial({ color: '#080808', roughness: 1.0 }), []);

  return (
    <group>
      {/* Road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.36, 0]} receiveShadow material={roadMat}>
        <planeGeometry args={[120, 9]} />
      </mesh>

      {/* Shoulders */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.355, 3.4]} material={shoulderMat}>
        <planeGeometry args={[120, 2.0]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.355, -3.4]} material={shoulderMat}>
        <planeGeometry args={[120, 2.0]} />
      </mesh>

      {/* Scrolling center dashes */}
      <group ref={markingsRef}>
        {Array.from({ length: 32 }).map((_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[-62 + i * 4, -0.35, 0]}
            material={markingMat}
          >
            <planeGeometry args={[2.0, 0.14]} />
          </mesh>
        ))}
      </group>

      {/* Edge lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.348, 2.7]} material={edgeMat}>
        <planeGeometry args={[120, 0.10]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.348, -2.7]} material={edgeMat}>
        <planeGeometry args={[120, 0.10]} />
      </mesh>

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.38, 0]} receiveShadow material={groundMat}>
        <planeGeometry args={[400, 400]} />
      </mesh>
    </group>
  );
}
