import React, { useMemo } from 'react';
import * as THREE from 'three';

/** Minimal wire environment — just horizon grid + sparse stars */
export default function Environment() {
  // Horizon grid (perspective grid receding into distance)
  const horizonGrid = useMemo(() => {
    const pts = [];
    // Converging lines toward vanishing point
    for (let i = -6; i <= 6; i++) {
      pts.push(i * 3, -0.36, -4,   i * 40, -0.36, -80);
      pts.push(i * 3, -0.36,  4,   i * 40, -0.36,  80);
    }
    // Cross lines
    for (let d = 1; d <= 10; d++) {
      const z = -d * 8;
      const w = d * 18;
      pts.push(-w, -0.36, z,  w, -0.36, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  // Star field
  const starGeo = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 300; i++) {
      pts.push(
        (Math.random() - 0.5) * 300,
        8 + Math.random() * 50,
        (Math.random() - 0.5) * 300,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <group>
      {/* Sky — pure black */}
      <mesh>
        <sphereGeometry args={[200, 16, 8]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
      </mesh>

      {/* Stars */}
      <points geometry={starGeo}>
        <pointsMaterial color="#00aacc" size={0.06} sizeAttenuation transparent opacity={0.5} />
      </points>

      {/* Horizon perspective grid */}
      <lineSegments geometry={horizonGrid}>
        <lineBasicMaterial color="#002233" transparent opacity={0.35} />
      </lineSegments>

      {/* Subtle ambient — just enough to see lines */}
      <ambientLight intensity={0.02} color="#00e5ff" />
    </group>
  );
}
