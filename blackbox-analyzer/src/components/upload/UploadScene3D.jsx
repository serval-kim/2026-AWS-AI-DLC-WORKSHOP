import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import CarModel from './CarModel';
import Road from './Road';
import Environment from './Environment';
import CameraRig from './CameraRig';
import BlackboxOverlay from './BlackboxOverlay';

/** Car moves left (negative X) while driving */
function MovingCar({ phase }) {
  const groupRef = useRef();
  const posX = useRef(4); // start slightly right of center

  useFrame((_, delta) => {
    if (phase === 'driving' && groupRef.current) {
      posX.current -= delta * 3.5;
      // Loop: when car exits left, reset to right
      if (posX.current < -20) posX.current = 20;
      groupRef.current.position.x = posX.current;
    }
  });

  return (
    <group ref={groupRef} position={[4, 0, 0]}>
      <CarModel phase={phase} />
    </group>
  );
}

/** Particle dust/rain effect */
function Particles() {
  const ref = useRef();
  const positions = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 200; i++) {
      arr.push(
        (Math.random() - 0.5) * 30,
        Math.random() * 6,
        (Math.random() - 0.5) * 8,
      );
    }
    return new Float32Array(arr);
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      const pos = ref.current.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] -= delta * 4; // drift left with car
        if (pos[i] < -15) pos[i] = 15;
        pos[i + 1] -= delta * 0.3;
        if (pos[i + 1] < -0.5) pos[i + 1] = 6;
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#88aaff" size={0.04} sizeAttenuation transparent opacity={0.4} />
    </points>
  );
}

export default function UploadScene3D({ onUpload }) {
  // phase: 'driving' → 'zooming' → 'interior'
  const [phase, setPhase] = useState('driving');
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    // After 2s: start zoom
    const t1 = setTimeout(() => setPhase('zooming'), 2000);
    // After zoom animation (~1.8s): show interior + overlay
    const t2 = setTimeout(() => {
      setPhase('interior');
      setShowOverlay(true);
    }, 3900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [0, 2.2, 9], fov: 60, near: 0.01, far: 500 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        style={{ background: '#050810' }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.08} color="#1a2040" />
          <directionalLight
            position={[5, 8, 3]}
            intensity={0.4}
            color="#6080ff"
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          {/* Moon-like top light */}
          <directionalLight position={[-3, 10, -5]} intensity={0.15} color="#aabbff" />

          {/* Scene objects */}
          <Road speed={phase === 'driving' ? 1 : 0} />
          <Environment />
          <MovingCar phase={phase} />
          <Particles />

          {/* Camera controller */}
          <CameraRig phase={phase} />

          {/* Post-processing */}
          <EffectComposer>
            <Bloom
              intensity={1.4}
              luminanceThreshold={0.3}
              luminanceSmoothing={0.9}
              blendFunction={BlendFunction.ADD}
            />
            <ChromaticAberration
              offset={[0.0008, 0.0008]}
              blendFunction={BlendFunction.NORMAL}
            />
            <Vignette
              offset={0.3}
              darkness={0.7}
              blendFunction={BlendFunction.NORMAL}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* HTML overlay for upload UI */}
      <BlackboxOverlay visible={showOverlay} onUpload={onUpload} />

      {/* Skip hint */}
      {phase === 'driving' && (
        <div
          onClick={() => {
            setPhase('zooming');
            setTimeout(() => { setPhase('interior'); setShowOverlay(true); }, 1900);
          }}
          style={{
            position: 'absolute', bottom: 24, right: 24,
            color: 'rgba(148,163,184,0.5)', fontSize: 12,
            cursor: 'pointer', userSelect: 'none',
            transition: 'color 0.2s',
            zIndex: 20,
          }}
          onMouseEnter={e => e.target.style.color = 'rgba(148,163,184,0.9)'}
          onMouseLeave={e => e.target.style.color = 'rgba(148,163,184,0.5)'}
        >
          건너뛰기 →
        </div>
      )}
    </div>
  );
}
