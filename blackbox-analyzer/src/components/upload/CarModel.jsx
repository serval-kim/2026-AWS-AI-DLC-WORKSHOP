import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Procedural sedan — monochrome palette.
 * Car faces +X direction (moves left = negative X).
 */
export default function CarModel({ phase }) {
  const wheelRefs = [useRef(), useRef(), useRef(), useRef()];

  useFrame((_, delta) => {
    if (phase === 'driving' || phase === 'zooming') {
      wheelRefs.forEach(r => {
        if (r.current) r.current.rotation.x -= delta * 9;
      });
    }
  });

  // ── Monochrome materials ──────────────────────────────────────────────────
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1c1c1c',
    metalness: 0.9,
    roughness: 0.12,
  }), []);

  const bodyAccentMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2a2a2a',
    metalness: 0.7,
    roughness: 0.25,
  }), []);

  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1a1a',
    metalness: 0.05,
    roughness: 0.0,
    transparent: true,
    opacity: 0.45,
  }), []);

  const wheelMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0d0d0d',
    metalness: 0.2,
    roughness: 0.9,
  }), []);

  const rimMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#555555',
    metalness: 0.95,
    roughness: 0.05,
  }), []);

  // Headlights: pure white emissive
  const headlightMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: 5,
  }), []);

  // Taillights: keep red — it's the only accent color, punches through B&W
  const taillightMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cc1100',
    emissive: '#ff2200',
    emissiveIntensity: 6,
  }), []);

  const chromeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#444444',
    metalness: 1.0,
    roughness: 0.04,
  }), []);

  const bbMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#111111',
    metalness: 0.8,
    roughness: 0.2,
  }), []);

  const bbLensMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#001133',
    emissive: '#0055ff',
    emissiveIntensity: 0.8,
  }), []);

  // ── Wheel sub-component ───────────────────────────────────────────────────
  const WheelGroup = ({ idx, position }) => (
    <group position={position} ref={wheelRefs[idx]} rotation={[0, 0, Math.PI / 2]}>
      {/* Tire */}
      <mesh material={wheelMat} castShadow>
        <cylinderGeometry args={[0.33, 0.33, 0.24, 28]} />
      </mesh>
      {/* Rim face */}
      <mesh material={rimMat} position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.20, 0.20, 0.22, 16]} />
      </mesh>
      {/* 5 spokes */}
      {[0, 1, 2, 3, 4].map(j => (
        <mesh key={j} material={rimMat} rotation={[0, (j / 5) * Math.PI * 2, 0]}>
          <boxGeometry args={[0.045, 0.28, 0.06]} />
        </mesh>
      ))}
      {/* Hub cap */}
      <mesh material={chromeMat} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
      </mesh>
    </group>
  );

  return (
    <group>
      {/* ── LOWER BODY ── */}
      <mesh material={bodyMat} castShadow receiveShadow position={[0, 0.30, 0]}>
        <boxGeometry args={[4.3, 0.58, 1.85]} />
      </mesh>

      {/* ── SILL / ROCKER PANEL ── */}
      <mesh material={chromeMat} position={[0, 0.04, 0.94]}>
        <boxGeometry args={[3.6, 0.08, 0.06]} />
      </mesh>
      <mesh material={chromeMat} position={[0, 0.04, -0.94]}>
        <boxGeometry args={[3.6, 0.08, 0.06]} />
      </mesh>

      {/* ── CABIN ── */}
      <mesh material={bodyMat} castShadow position={[0.05, 0.84, 0]}>
        <boxGeometry args={[2.3, 0.54, 1.68]} />
      </mesh>

      {/* ── ROOF ── */}
      <mesh material={bodyAccentMat} castShadow position={[0.05, 1.06, 0]}>
        <boxGeometry args={[2.0, 0.20, 1.60]} />
      </mesh>

      {/* ── WINDSHIELD (front, angled) ── */}
      <mesh material={glassMat} position={[1.22, 0.80, 0]} rotation={[0, 0, -0.50]}>
        <boxGeometry args={[0.07, 0.66, 1.56]} />
      </mesh>

      {/* ── REAR WINDOW ── */}
      <mesh material={glassMat} position={[-1.05, 0.80, 0]} rotation={[0, 0, 0.50]}>
        <boxGeometry args={[0.07, 0.66, 1.56]} />
      </mesh>

      {/* ── SIDE WINDOWS ── */}
      <mesh material={glassMat} position={[0.25, 0.86, 0.845]}>
        <boxGeometry args={[1.7, 0.40, 0.04]} />
      </mesh>
      <mesh material={glassMat} position={[0.25, 0.86, -0.845]}>
        <boxGeometry args={[1.7, 0.40, 0.04]} />
      </mesh>

      {/* ── HOOD ── */}
      <mesh material={bodyMat} castShadow position={[1.85, 0.44, 0]} rotation={[0, 0, 0.07]}>
        <boxGeometry args={[1.25, 0.13, 1.78]} />
      </mesh>

      {/* ── TRUNK LID ── */}
      <mesh material={bodyMat} castShadow position={[-1.72, 0.48, 0]}>
        <boxGeometry args={[0.85, 0.16, 1.78]} />
      </mesh>

      {/* ── FRONT BUMPER ── */}
      <mesh material={chromeMat} position={[2.18, 0.20, 0]}>
        <boxGeometry args={[0.14, 0.30, 1.78]} />
      </mesh>
      {/* Lower grille strip */}
      <mesh material={bodyAccentMat} position={[2.19, 0.10, 0]}>
        <boxGeometry args={[0.10, 0.12, 1.40]} />
      </mesh>

      {/* ── REAR BUMPER ── */}
      <mesh material={chromeMat} position={[-2.18, 0.20, 0]}>
        <boxGeometry args={[0.14, 0.30, 1.78]} />
      </mesh>

      {/* ── HEADLIGHTS ── */}
      <mesh material={headlightMat} position={[2.16, 0.34, 0.64]}>
        <boxGeometry args={[0.09, 0.16, 0.36]} />
      </mesh>
      <mesh material={headlightMat} position={[2.16, 0.34, -0.64]}>
        <boxGeometry args={[0.09, 0.16, 0.36]} />
      </mesh>
      {/* DRL strip */}
      <mesh material={headlightMat} position={[2.17, 0.24, 0]}>
        <boxGeometry args={[0.06, 0.05, 1.10]} />
      </mesh>

      {/* Headlight point lights */}
      <pointLight position={[2.6, 0.34, 0.64]}  color="#ffffff" intensity={8}  distance={12} decay={2} />
      <pointLight position={[2.6, 0.34, -0.64]} color="#ffffff" intensity={8}  distance={12} decay={2} />
      {/* Cone beam on road */}
      <spotLight
        position={[2.5, 0.5, 0.5]}
        target-position={[8, -0.3, 0.5]}
        color="#ffffff"
        intensity={12}
        angle={0.28}
        penumbra={0.6}
        distance={18}
        decay={2}
        castShadow={false}
      />

      {/* ── TAILLIGHTS ── */}
      <mesh material={taillightMat} position={[-2.16, 0.34, 0.64]}>
        <boxGeometry args={[0.09, 0.18, 0.42]} />
      </mesh>
      <mesh material={taillightMat} position={[-2.16, 0.34, -0.64]}>
        <boxGeometry args={[0.09, 0.18, 0.42]} />
      </mesh>
      {/* Tail strip */}
      <mesh material={taillightMat} position={[-2.17, 0.26, 0]}>
        <boxGeometry args={[0.06, 0.06, 1.0]} />
      </mesh>

      {/* Taillight glow */}
      <pointLight position={[-2.5, 0.34, 0.64]}  color="#ff2200" intensity={6} distance={8} decay={2} />
      <pointLight position={[-2.5, 0.34, -0.64]} color="#ff2200" intensity={6} distance={8} decay={2} />

      {/* ── WHEELS ── */}
      <WheelGroup idx={0} position={[ 1.25, -0.03,  1.02]} />
      <WheelGroup idx={1} position={[ 1.25, -0.03, -1.02]} />
      <WheelGroup idx={2} position={[-1.25, -0.03,  1.02]} />
      <WheelGroup idx={3} position={[-1.25, -0.03, -1.02]} />

      {/* ── BLACKBOX CAMERA (on windshield, interior) ── */}
      <mesh material={bbMat} position={[0.62, 0.74, 0.05]}>
        <boxGeometry args={[0.13, 0.09, 0.20]} />
      </mesh>
      <mesh material={bbLensMat} position={[0.70, 0.74, 0.05]}>
        <cylinderGeometry args={[0.032, 0.032, 0.025, 14]} />
      </mesh>
    </group>
  );
}
