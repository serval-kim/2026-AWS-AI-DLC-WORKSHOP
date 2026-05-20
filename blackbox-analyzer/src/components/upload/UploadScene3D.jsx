import React, { useRef, useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  EffectComposer, Bloom, Vignette, ChromaticAberration, Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import CarModel from './CarModel';
import Road from './Road';
import Environment from './Environment';
import BlackboxOverlay from './BlackboxOverlay';

// ─── Constants ────────────────────────────────────────────────────────────────
const CAR_START_X    = 14;
const PERSON_X       = 2;
const STOP_DIST      = 1.8;
const ZOOM_TRIGGER   = 5.5;
const CAR_SPEED      = 3.5;

// Camera FOV journey
const FOV_SIDE       = 42;   // side tracking
const FOV_ENTER      = 72;   // just entered interior
const FOV_FINAL      = 14;   // maximum zoom-in (telephoto)
const FOV_ZOOM_SPEED = 1.8;  // degrees per second (slow, cinematic)
const FLASH_FOV      = 22;   // fire flash at this FOV

// ─── Easing ───────────────────────────────────────────────────────────────────
function easeInOut3(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function smoothLerp(a, b, alpha) { return a + (b - a) * alpha; }

// ─── Person ───────────────────────────────────────────────────────────────────
function Person() {
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: '#ffffff' }), []);
  const parts = useMemo(() => [
    { geo: new THREE.BoxGeometry(0.38, 0.95, 0.22), pos: [0, 0.88, 0] },
    { geo: new THREE.BoxGeometry(0.26, 0.26, 0.26), pos: [0, 1.62, 0] },
    { geo: new THREE.BoxGeometry(0.13, 0.52, 0.14), pos: [-0.10, 0.22, 0] },
    { geo: new THREE.BoxGeometry(0.13, 0.52, 0.14), pos: [ 0.10, 0.22, 0] },
    { geo: new THREE.BoxGeometry(0.10, 0.55, 0.12), pos: [-0.27, 0.88, 0] },
    { geo: new THREE.BoxGeometry(0.10, 0.55, 0.12), pos: [ 0.27, 0.88, 0] },
  ], []);
  return (
    <group position={[PERSON_X, 0, 0]}>
      {parts.map((p, i) => (
        <lineSegments key={i} position={p.pos}>
          <edgesGeometry args={[p.geo]} />
          <primitive object={mat} attach="material" />
        </lineSegments>
      ))}
      <pointLight position={[0, 1, 0]} color="#ffffff" intensity={1.0} distance={4} decay={2} />
    </group>
  );
}

// ─── Headlights ───────────────────────────────────────────────────────────────
function HeadlightBeams({ carPosRef }) {
  const groupRef = useRef();

  const innerMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fffbe0', transparent: true, opacity: 0.20,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  const outerMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fffbe0', transparent: true, opacity: 0.07,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  const coneMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0.025,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);

  const innerGeo = useMemo(() => { const g = new THREE.PlaneGeometry(4, 2.4); g.rotateX(-Math.PI/2); return g; }, []);
  const outerGeo = useMemo(() => { const g = new THREE.PlaneGeometry(14, 5); g.rotateX(-Math.PI/2); return g; }, []);
  const coneGeo  = useMemo(() => {
    const g = new THREE.ConeGeometry(2.4, 14, 22, 1, true);
    g.rotateZ(-Math.PI/2); g.translate(-7, 0, 0); return g;
  }, []);

  useFrame(() => {
    if (groupRef.current) groupRef.current.position.x = carPosRef.current - 2.2;
  });

  return (
    <group ref={groupRef} position={[CAR_START_X - 2.2, 0, 0]}>
      <mesh geometry={coneGeo} material={coneMat} position={[0, 0.38,  0.52]} />
      <mesh geometry={coneGeo} material={coneMat} position={[0, 0.38, -0.52]} />
      <mesh geometry={innerGeo} material={innerMat} position={[-1.8, 0.01, 0]} />
      <mesh geometry={outerGeo} material={outerMat} position={[-8,   0.01, 0]} />
      {/* High penumbra = very soft edge on road */}
      <spotLight position={[0, 0.38,  0.52]} target-position={[-18, -0.36,  0.52]}
        color="#fffbe8" intensity={60} angle={0.17} penumbra={0.92} distance={28} decay={1.1} />
      <spotLight position={[0, 0.38, -0.52]} target-position={[-18, -0.36, -0.52]}
        color="#fffbe8" intensity={60} angle={0.17} penumbra={0.92} distance={28} decay={1.1} />
      <pointLight position={[0, 0.38,  0.52]} color="#ffffff" intensity={5} distance={3} decay={2} />
      <pointLight position={[0, 0.38, -0.52]} color="#ffffff" intensity={5} distance={3} decay={2} />
    </group>
  );
}

// ─── Flash ────────────────────────────────────────────────────────────────────
function FlashOverlay({ flashRef }) {
  const divRef = useRef();
  useEffect(() => {
    flashRef.current = () => {
      if (!divRef.current) return;
      divRef.current.style.opacity = '1';
      let op = 1;
      const iv = setInterval(() => {
        op -= 0.055;
        if (op <= 0) { op = 0; clearInterval(iv); }
        if (divRef.current) divRef.current.style.opacity = String(op);
      }, 16);
    };
  }, []);
  return (
    <div ref={divRef} style={{
      position: 'absolute', inset: 0, background: '#ffffff',
      opacity: 0, pointerEvents: 'none', zIndex: 50, transition: 'none',
    }} />
  );
}

// ─── Car ──────────────────────────────────────────────────────────────────────
function MovingCar({ phaseRef, carPosRef }) {
  const groupRef = useRef();
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (phaseRef.current === 'approach') {
      const dist = carPosRef.current - PERSON_X;
      if (dist > STOP_DIST) {
        const progress = 1 - Math.min(1, dist / (CAR_START_X - PERSON_X));
        const speedMult = 0.4 + 0.6 * Math.sin(progress * Math.PI);
        carPosRef.current -= delta * CAR_SPEED * Math.max(0.3, speedMult);
      }
    }
    // toosclose / interior: frozen
    groupRef.current.position.x = carPosRef.current;
  });
  return (
    <group ref={groupRef} position={[carPosRef.current, 0, 0]}>
      <group rotation={[0, -Math.PI / 2, 0]}>
        <CarModel phase="driving" lineColor="#ffffff" />
      </group>
    </group>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────────
// mouseOffsetRef: {x, y} normalized -1..1, updated from parent
function SceneCamera({ phaseRef, carPosRef, mouseOffsetRef, flashTrigger }) {
  const { camera } = useThree();

  const zoomT       = useRef(0);
  const zoomStarted = useRef(false);
  const zoomFrom    = useRef(new THREE.Vector3());

  const camPos    = useRef(new THREE.Vector3(15, 1.25, 9));
  const camTarget = useRef(new THREE.Vector3(14, 0.6, 0));
  const camFov    = useRef(FOV_SIDE);

  // Flash fired flag
  const flashFired = useRef(false);

  // BB position inside car (car rotated -90°Y → front = -X)
  const BB_POS  = new THREE.Vector3(-0.3, 0.85, 0.05);
  const BB_LOOK = new THREE.Vector3(-12,  0.85, 0.05);

  useFrame((_, delta) => {
    const phase = phaseRef.current;
    const carX  = carPosRef.current;

    // Mouse parallax offset (inverted — scene moves opposite to mouse)
    const mx = mouseOffsetRef.current.x;
    const my = mouseOffsetRef.current.y;

    if (phase === 'approach') {
      const tX = carX + 0.8 - mx * 0.6;  // parallax X
      const tY = 1.25 + my * 0.25;        // parallax Y
      const tZ = 9.0  + mx * 0.3;         // slight Z shift

      camPos.current.x = smoothLerp(camPos.current.x, tX, 0.06);
      camPos.current.y = smoothLerp(camPos.current.y, tY, 0.04);
      camPos.current.z = smoothLerp(camPos.current.z, tZ, 0.04);
      camTarget.current.set(carX - mx * 0.4, 0.6 + my * 0.15, 0);
      camFov.current = smoothLerp(camFov.current, FOV_SIDE, 0.03);
    }

    else if (phase === 'toosclose') {
      if (!zoomStarted.current) {
        zoomStarted.current = true;
        zoomT.current = 0;
        zoomFrom.current.copy(camPos.current);
      }
      zoomT.current = Math.min(zoomT.current + delta * 0.28, 1);
      const ease = easeInOut3(zoomT.current);

      const bbWorld = new THREE.Vector3(carX + BB_POS.x, BB_POS.y, BB_POS.z);
      camPos.current.lerpVectors(zoomFrom.current, bbWorld, ease);

      const lStart = new THREE.Vector3(PERSON_X, 0.9, 0);
      const lEnd   = new THREE.Vector3(carX + BB_LOOK.x, BB_LOOK.y, 0);
      camTarget.current.lerpVectors(lStart, lEnd, ease);

      camFov.current = smoothLerp(camFov.current, FOV_ENTER, ease * 0.1 + 0.01);
    }

    else if (phase === 'interior') {
      // Position: locked to BB with tiny breathing
      const breathe = Date.now() * 0.00032;
      const bbWorld = new THREE.Vector3(
        carX + BB_POS.x + Math.sin(breathe * 0.5) * 0.004,
        BB_POS.y        + Math.sin(breathe * 0.8) * 0.002,
        BB_POS.z,
      );
      camPos.current.lerp(bbWorld, 0.06);
      camTarget.current.set(carX + BB_LOOK.x, BB_LOOK.y, 0);

      // Continuous slow zoom-in: FOV decreases toward FOV_FINAL
      if (camFov.current > FOV_FINAL) {
        camFov.current = Math.max(FOV_FINAL, camFov.current - delta * FOV_ZOOM_SPEED);
      }

      // Fire flash once when FOV crosses FLASH_FOV
      if (!flashFired.current && camFov.current <= FLASH_FOV) {
        flashFired.current = true;
        if (flashTrigger.current) flashTrigger.current();
      }
    }

    camera.position.copy(camPos.current);
    camera.lookAt(camTarget.current);
    camera.fov = camFov.current;
    camera.updateProjectionMatrix();
  });

  return null;
}

// ─── Post-processing ──────────────────────────────────────────────────────────
function FX() {
  return (
    <EffectComposer>
      <Bloom intensity={1.5} luminanceThreshold={0.09} luminanceSmoothing={0.92}
        blendFunction={BlendFunction.ADD} />
      <ChromaticAberration offset={[0.0009, 0.0009]} blendFunction={BlendFunction.NORMAL} />
      <Noise opacity={0.028} blendFunction={BlendFunction.ADD} />
      <Vignette offset={0.25} darkness={0.90} blendFunction={BlendFunction.NORMAL} />
    </EffectComposer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function UploadScene3D({ onAnalysisComplete }) {
  const phaseRef     = useRef('approach');
  const carPosRef    = useRef(CAR_START_X);
  const flashTrigger = useRef(null);
  const mouseOffset  = useRef({ x: 0, y: 0 });  // normalized -1..1

  const [showOverlay, setShowOverlay] = useState(false);
  const [phase, setPhase] = useState('approach');

  function advancePhase(next) {
    phaseRef.current = next;
    setPhase(next);
  }

  // Mouse tracking — update ref (no re-render)
  const handleMouseMove = useCallback((e) => {
    const x = (e.clientX / window.innerWidth  - 0.5) * 2;  // -1..1
    const y = (e.clientY / window.innerHeight - 0.5) * 2;  // -1..1
    // Smooth target (actual smoothing happens in useFrame lerp)
    mouseOffset.current.x = x;
    mouseOffset.current.y = y;
  }, []);

  // Watch car position → trigger zoom
  useEffect(() => {
    let raf;
    function check() {
      const dist = carPosRef.current - PERSON_X;
      if (phaseRef.current === 'approach' && dist <= ZOOM_TRIGGER) {
        advancePhase('toosclose');
        // After transition (~3.6s), enter interior + show overlay
        setTimeout(() => {
          advancePhase('interior');
          setShowOverlay(true);
        }, 3600);
      }
      raf = requestAnimationFrame(check);
    }
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, []);

  function skipIntro() {
    carPosRef.current = PERSON_X + ZOOM_TRIGGER;
    advancePhase('toosclose');
    setTimeout(() => {
      advancePhase('interior');
      setShowOverlay(true);
    }, 3600);
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}
      onMouseMove={handleMouseMove}
    >
      <Canvas
        shadows
        camera={{ position: [15, 1.25, 9], fov: FOV_SIDE, near: 0.005, far: 800 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        style={{ background: '#000000' }}
      >
        <Suspense fallback={null}>
          <Environment />
          <Road speed={phase === 'approach' ? 1 : 0} />
          <MovingCar phaseRef={phaseRef} carPosRef={carPosRef} />
          <HeadlightBeams carPosRef={carPosRef} />
          <Person />
          <SceneCamera
            phaseRef={phaseRef}
            carPosRef={carPosRef}
            mouseOffsetRef={mouseOffset}
            flashTrigger={flashTrigger}
          />
          <FX />
        </Suspense>
      </Canvas>

      <FlashOverlay flashRef={flashTrigger} />

      <BlackboxOverlay
        visible={showOverlay}
        onUpload={onAnalysisComplete}
      />

      {!showOverlay && (
        <button
          onClick={skipIntro}
          style={{
            position: 'absolute', bottom: 28, right: 28,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6, color: 'rgba(255,255,255,0.3)',
            fontSize: 11, padding: '5px 14px',
            cursor: 'pointer', fontFamily: "'Noto Sans KR', sans-serif",
            letterSpacing: '0.08em', transition: 'all 0.2s', zIndex: 20,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
        >
          SKIP →
        </button>
      )}
    </div>
  );
}
