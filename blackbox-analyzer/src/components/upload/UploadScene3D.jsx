import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, HueSaturation } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import CarModel from './CarModel';
import Road from './Road';
import Environment from './Environment';
import CameraRig from './CameraRig';
import BlackboxOverlay from './BlackboxOverlay';

/**
 * Car moves in -X direction.
 * Exposes its current X position via carPosRef so CameraRig can follow.
 */
function MovingCar({ phase, carPosRef }) {
  const groupRef = useRef();
  // Start at x=6 so car enters from right
  carPosRef.current = 6;

  useFrame((_, delta) => {
    if ((phase === 'driving' || phase === 'zooming') && groupRef.current) {
      carPosRef.current -= delta * 4.0;
      // Loop back when fully off-screen left
      if (carPosRef.current < -22) carPosRef.current = 22;
      groupRef.current.position.x = carPosRef.current;
    }
  });

  return (
    <group ref={groupRef} position={[6, 0, 0]}>
      <CarModel phase={phase} />
    </group>
  );
}

/** Dust particles drifting with the car */
function Particles() {
  const ref = useRef();
  const positions = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 180; i++) {
      arr.push(
        (Math.random() - 0.5) * 40,
        Math.random() * 5,
        (Math.random() - 0.5) * 7,
      );
    }
    return new Float32Array(arr);
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      const pos = ref.current.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] -= delta * 4;
        if (pos[i] < -20) pos[i] = 20;
        pos[i + 1] -= delta * 0.2;
        if (pos[i + 1] < -0.4) pos[i + 1] = 5;
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#888888" size={0.035} sizeAttenuation transparent opacity={0.3} />
    </points>
  );
}

export default function UploadScene3D({ onUpload }) {
  const [phase, setPhase] = useState('driving');
  const [showOverlay, setShowOverlay] = useState(false);
  // Shared ref: car's current world X position
  const carPosRef = useRef(6);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('zooming'), 2200);
    const t2 = setTimeout(() => {
      setPhase('interior');
      setShowOverlay(true);
    }, 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function skipIntro() {
    setPhase('zooming');
    setTimeout(() => { setPhase('interior'); setShowOverlay(true); }, 2000);
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [7, 1.4, 7], fov: 55, near: 0.01, far: 600 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
        }}
        style={{ background: '#050505' }}
      >
        <Suspense fallback={null}>
          {/* ── Lighting (monochrome) ── */}
          <ambientLight intensity={0.06} color="#ffffff" />
          {/* Key light from above-front */}
          <directionalLight
            position={[8, 10, 4]}
            intensity={0.5}
            color="#cccccc"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={0.5}
            shadow-camera-far={60}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          {/* Rim light from behind */}
          <directionalLight position={[-6, 5, -3]} intensity={0.2} color="#aaaaaa" />

          {/* ── Scene ── */}
          <Road speed={phase === 'driving' ? 1 : 0} />
          <Environment />
          <MovingCar phase={phase} carPosRef={carPosRef} />
          <Particles />

          {/* ── Camera ── */}
          <CameraRig phase={phase} carPosRef={carPosRef} />

          {/* ── Post-processing ── */}
          <EffectComposer>
            {/* Full desaturation → true B&W */}
            <HueSaturation
              hue={0}
              saturation={-1.0}
              blendFunction={BlendFunction.NORMAL}
            />
            {/* Bloom for light glow */}
            <Bloom
              intensity={1.8}
              luminanceThreshold={0.25}
              luminanceSmoothing={0.85}
              blendFunction={BlendFunction.ADD}
            />
            {/* Cinematic vignette */}
            <Vignette
              offset={0.28}
              darkness={0.75}
              blendFunction={BlendFunction.NORMAL}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* Upload UI overlay */}
      <BlackboxOverlay visible={showOverlay} onUpload={onUpload} />

      {/* Skip button */}
      {!showOverlay && (
        <button
          onClick={skipIntro}
          style={{
            position: 'absolute', bottom: 24, right: 24,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12,
            padding: '6px 14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
            zIndex: 20,
          }}
          onMouseEnter={e => {
            e.target.style.color = 'rgba(255,255,255,0.8)';
            e.target.style.borderColor = 'rgba(255,255,255,0.4)';
          }}
          onMouseLeave={e => {
            e.target.style.color = 'rgba(255,255,255,0.35)';
            e.target.style.borderColor = 'rgba(255,255,255,0.15)';
          }}
        >
          건너뛰기 →
        </button>
      )}
    </div>
  );
}
