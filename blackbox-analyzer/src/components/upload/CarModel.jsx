import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Procedural low-poly car — no external model file needed.
 * Matches the reference: sedan silhouette, visible wheels, headlights & taillights.
 */
export default function CarModel({ phase }) {
  const groupRef = useRef();
  const wheelRefs = [useRef(), useRef(), useRef(), useRef()];

  // Wheel spin
  useFrame((_, delta) => {
    if (phase === 'driving') {
      wheelRefs.forEach(r => {
        if (r.current) r.current.rotation.x -= delta * 8;
      });
    }
  });

  // Body color
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1a2e',
    metalness: 0.85,
    roughness: 0.15,
    envMapIntensity: 1.2,
  }), []);

  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0a2a4a',
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.55,
  }), []);

  const wheelMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#111111',
    metalness: 0.3,
    roughness: 0.8,
  }), []);

  const rimMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#888888',
    metalness: 0.9,
    roughness: 0.1,
  }), []);

  const headlightMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: 3,
  }), []);

  const taillightMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff2200',
    emissive: '#ff2200',
    emissiveIntensity: 4,
  }), []);

  const chromeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cccccc',
    metalness: 1,
    roughness: 0.05,
  }), []);

  // Wheel component
  const Wheel = ({ position, ref: wRef }) => (
    <group position={position} ref={wRef} rotation={[0, 0, Math.PI / 2]}>
      {/* Tire */}
      <mesh material={wheelMat} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.22, 24]} />
      </mesh>
      {/* Rim */}
      <mesh material={rimMat}>
        <cylinderGeometry args={[0.18, 0.18, 0.24, 12]} />
      </mesh>
      {/* Spokes */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} material={rimMat} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
          <boxGeometry args={[0.04, 0.26, 0.28]} />
        </mesh>
      ))}
    </group>
  );

  return (
    <group ref={groupRef}>
      {/* ── MAIN BODY (lower) ── */}
      <mesh material={bodyMat} castShadow receiveShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[4.2, 0.56, 1.8]} />
      </mesh>

      {/* ── CABIN ── */}
      <mesh material={bodyMat} castShadow position={[0.1, 0.82, 0]}>
        <boxGeometry args={[2.2, 0.52, 1.62]} />
      </mesh>

      {/* ── CABIN ROOF (rounded top) ── */}
      <mesh material={bodyMat} castShadow position={[0.1, 1.0, 0]}>
        <boxGeometry args={[1.9, 0.18, 1.55]} />
      </mesh>

      {/* ── WINDSHIELD (front) ── */}
      <mesh material={glassMat} position={[1.18, 0.78, 0]} rotation={[0, 0, -0.52]}>
        <boxGeometry args={[0.06, 0.62, 1.5]} />
      </mesh>

      {/* ── REAR WINDOW ── */}
      <mesh material={glassMat} position={[-1.0, 0.78, 0]} rotation={[0, 0, 0.52]}>
        <boxGeometry args={[0.06, 0.62, 1.5]} />
      </mesh>

      {/* ── SIDE WINDOWS ── */}
      <mesh material={glassMat} position={[0.3, 0.84, 0.82]}>
        <boxGeometry args={[1.6, 0.38, 0.04]} />
      </mesh>
      <mesh material={glassMat} position={[0.3, 0.84, -0.82]}>
        <boxGeometry args={[1.6, 0.38, 0.04]} />
      </mesh>

      {/* ── HOOD ── */}
      <mesh material={bodyMat} castShadow position={[1.8, 0.42, 0]} rotation={[0, 0, 0.08]}>
        <boxGeometry args={[1.2, 0.12, 1.72]} />
      </mesh>

      {/* ── TRUNK ── */}
      <mesh material={bodyMat} castShadow position={[-1.7, 0.46, 0]}>
        <boxGeometry args={[0.8, 0.18, 1.72]} />
      </mesh>

      {/* ── FRONT BUMPER ── */}
      <mesh material={chromeMat} position={[2.12, 0.18, 0]}>
        <boxGeometry args={[0.12, 0.28, 1.72]} />
      </mesh>

      {/* ── REAR BUMPER ── */}
      <mesh material={chromeMat} position={[-2.12, 0.18, 0]}>
        <boxGeometry args={[0.12, 0.28, 1.72]} />
      </mesh>

      {/* ── HEADLIGHTS (front, both sides) ── */}
      <mesh material={headlightMat} position={[2.1, 0.32, 0.62]}>
        <boxGeometry args={[0.08, 0.14, 0.32]} />
      </mesh>
      <mesh material={headlightMat} position={[2.1, 0.32, -0.62]}>
        <boxGeometry args={[0.08, 0.14, 0.32]} />
      </mesh>

      {/* ── HEADLIGHT LENS GLOW ── */}
      <pointLight position={[2.4, 0.32, 0.62]} color="#ffffff" intensity={6} distance={8} decay={2} />
      <pointLight position={[2.4, 0.32, -0.62]} color="#ffffff" intensity={6} distance={8} decay={2} />

      {/* ── TAILLIGHTS (rear, both sides) ── */}
      <mesh material={taillightMat} position={[-2.1, 0.32, 0.62]}>
        <boxGeometry args={[0.08, 0.16, 0.38]} />
      </mesh>
      <mesh material={taillightMat} position={[-2.1, 0.32, -0.62]}>
        <boxGeometry args={[0.08, 0.16, 0.38]} />
      </mesh>

      {/* ── TAILLIGHT GLOW ── */}
      <pointLight position={[-2.4, 0.32, 0.62]} color="#ff2200" intensity={5} distance={6} decay={2} />
      <pointLight position={[-2.4, 0.32, -0.62]} color="#ff2200" intensity={5} distance={6} decay={2} />

      {/* ── WHEELS ── */}
      {[
        [1.2, -0.04, 1.0],
        [1.2, -0.04, -1.0],
        [-1.2, -0.04, 1.0],
        [-1.2, -0.04, -1.0],
      ].map((pos, i) => (
        <group key={i} position={pos} ref={wheelRefs[i]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={wheelMat} castShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.22, 24]} />
          </mesh>
          <mesh material={rimMat}>
            <cylinderGeometry args={[0.18, 0.18, 0.24, 12]} />
          </mesh>
          {[0, 1, 2, 3, 4].map(j => (
            <mesh key={j} material={rimMat} rotation={[0, (j / 5) * Math.PI * 2, 0]}>
              <boxGeometry args={[0.04, 0.26, 0.28]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── BLACKBOX CAMERA (dashboard, visible in phase 2) ── */}
      <mesh position={[0.6, 0.72, 0]} material={new THREE.MeshStandardMaterial({ color: '#111', metalness: 0.8, roughness: 0.2 })}>
        <boxGeometry args={[0.12, 0.08, 0.18]} />
      </mesh>
      <mesh position={[0.68, 0.72, 0]} material={new THREE.MeshStandardMaterial({ color: '#001133', emissive: '#0044ff', emissiveIntensity: 0.5 })}>
        <cylinderGeometry args={[0.03, 0.03, 0.02, 12]} />
      </mesh>
    </group>
  );
}
