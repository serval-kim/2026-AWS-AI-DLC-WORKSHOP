import React, { useRef, useState, useEffect, Suspense, useMemo, useCallback, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  EffectComposer, Bloom, Vignette, Noise,
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
const STOP_DIST      = 2.8;     // car stops further from person (no overlap)
const ZOOM_TRIGGER   = 3.5;     // start zoom-in when this close
const CAR_SPEED      = 3.5;

// Camera FOV journey
const FOV_SIDE       = 42;
const FOV_ENTER      = 72;
const FOV_FINAL      = 14;
const FOV_ZOOM_SPEED = 1.8;
const FLASH_FOV      = 22;

// ─── Easing ───────────────────────────────────────────────────────────────────
function easeInOut3(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function smoothLerp(a, b, alpha) { return a + (b - a) * alpha; }

// ─── Person — loads human.gltf as wireframe ──────────────────────────────────
function HumanGLTF() {
  const { scene } = useGLTF('/human.gltf');

  const wireScene = useMemo(() => {
    const root = scene.clone(true);
    const lineMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 });

    root.traverse(obj => {
      if (!obj.isMesh) return;
      try {
        const edges = new THREE.EdgesGeometry(obj.geometry, 25);
        obj.geometry = edges;
        obj.material = lineMat;
        obj.type = 'LineSegments';
        obj.isLine = true;
        obj.isLineSegments = true;
        obj.isMesh = false;
      } catch {
        obj.visible = false;
      }
    });
    return root;
  }, [scene]);

  return <primitive object={wireScene} />;
}

// Error boundary in case bin is missing
class HumanBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function Person() {
  // human.gltf scale = 0.01, X-rotation 90° → after that, model is upright
  // We don't know exact height, assume ~1.7-1.8m after scale. Tune Y if needed.
  return (
    <group position={[PERSON_X, 0, 0]}>
      <Suspense fallback={null}>
        <HumanBoundary>
          <HumanGLTF />
        </HumanBoundary>
      </Suspense>
      {/* Subtle rim light */}
      <pointLight position={[0, 1, 0]} color="#ffffff" intensity={1.0} distance={4} decay={2} />
    </group>
  );
}

useGLTF.preload('/human.gltf');

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
  const zoomFromTgt = useRef(new THREE.Vector3());
  const zoomFromFov = useRef(FOV_SIDE);

  // Base (without mouse parallax) positions — parallax is added on top each frame
  const camBase    = useRef(new THREE.Vector3(15, 1.25, 9));
  const camTgtBase = useRef(new THREE.Vector3(14, 0.6, 0));
  const camFov     = useRef(FOV_SIDE);

  // Smoothed mouse (lerps toward raw mouse)
  const smoothMouse = useRef({ x: 0, y: 0 });
  // Parallax strength: 1 during approach, fades to 0 during toosclose, near 0 in interior
  const parallaxStrength = useRef(1);

  const flashFired = useRef(false);

  const BB_POS  = new THREE.Vector3(-0.3, 0.85, 0.05);
  const BB_LOOK = new THREE.Vector3(-12,  0.85, 0.05);

  useFrame((_, delta) => {
    const phase = phaseRef.current;
    const carX  = carPosRef.current;

    // Smooth mouse toward raw input
    smoothMouse.current.x = smoothLerp(smoothMouse.current.x, mouseOffsetRef.current.x, 0.06);
    smoothMouse.current.y = smoothLerp(smoothMouse.current.y, mouseOffsetRef.current.y, 0.06);

    // Update parallax strength based on phase
    let targetStrength = 1;
    if (phase === 'toosclose') targetStrength = 0;     // fade out during transition
    if (phase === 'interior')  targetStrength = 0.25;  // subtle in interior
    parallaxStrength.current = smoothLerp(parallaxStrength.current, targetStrength, 0.04);

    // ── Compute base camera position/target by phase ────────────────────────
    if (phase === 'approach') {
      // Side tracking — base only (no mouse offset here)
      camBase.current.x = smoothLerp(camBase.current.x, carX + 0.8, 0.06);
      camBase.current.y = smoothLerp(camBase.current.y, 1.25,       0.04);
      camBase.current.z = smoothLerp(camBase.current.z, 9.0,        0.04);
      camTgtBase.current.set(carX, 0.6, 0);
      camFov.current = smoothLerp(camFov.current, FOV_SIDE, 0.03);
    }

    else if (phase === 'toosclose') {
      if (!zoomStarted.current) {
        zoomStarted.current = true;
        zoomT.current = 0;
        // Snapshot the BASE (without parallax) so transition is smooth
        zoomFrom.current.copy(camBase.current);
        zoomFromTgt.current.copy(camTgtBase.current);
        zoomFromFov.current = camFov.current;
      }
      zoomT.current = Math.min(zoomT.current + delta * 0.48, 1);
      const ease = easeInOut3(zoomT.current);

      const bbWorld = new THREE.Vector3(carX + BB_POS.x, BB_POS.y, BB_POS.z);
      camBase.current.lerpVectors(zoomFrom.current, bbWorld, ease);

      const lEnd = new THREE.Vector3(carX + BB_LOOK.x, BB_LOOK.y, 0);
      camTgtBase.current.lerpVectors(zoomFromTgt.current, lEnd, ease);

      camFov.current = THREE.MathUtils.lerp(zoomFromFov.current, FOV_ENTER, ease);
    }

    else if (phase === 'interior') {
      // Locked to BB with tiny breathing
      const breathe = Date.now() * 0.00032;
      camBase.current.lerp(new THREE.Vector3(
        carX + BB_POS.x + Math.sin(breathe * 0.5) * 0.004,
        BB_POS.y        + Math.sin(breathe * 0.8) * 0.002,
        BB_POS.z,
      ), 0.06);
      camTgtBase.current.set(carX + BB_LOOK.x, BB_LOOK.y, 0);

      // Continuous slow zoom-in
      if (camFov.current > FOV_FINAL) {
        camFov.current = Math.max(FOV_FINAL, camFov.current - delta * FOV_ZOOM_SPEED);
      }

      // Fire flash once
      if (!flashFired.current && camFov.current <= FLASH_FOV) {
        flashFired.current = true;
        if (flashTrigger.current) flashTrigger.current();
      }
    }

    // ── Apply mouse parallax (INVERTED: camera moves OPPOSITE to mouse) ─────
    // When mouse goes RIGHT (+mx), camera moves LEFT → scene appears to move RIGHT
    const mx = smoothMouse.current.x * parallaxStrength.current;
    const my = smoothMouse.current.y * parallaxStrength.current;

    // Strength varies by phase
    const isInterior = phase === 'interior';
    const posStrength    = isInterior ? 0.05 : 0.6;
    const tgtStrength    = isInterior ? 0.08 : 0.4;

    camera.position.set(
      camBase.current.x - mx * posStrength,
      camBase.current.y - my * posStrength,
      camBase.current.z,
    );
    camera.lookAt(
      camTgtBase.current.x + mx * tgtStrength,
      camTgtBase.current.y + my * tgtStrength,
      camTgtBase.current.z,
    );
    camera.fov = camFov.current;
    camera.updateProjectionMatrix();
  });

  return null;
}

// ─── Post-processing — restrained, no chromatic aberration ────────────────────
function FX() {
  return (
    <EffectComposer>
      <Bloom
        intensity={0.85}
        luminanceThreshold={0.18}
        luminanceSmoothing={0.95}
        mipmapBlur
        blendFunction={BlendFunction.ADD}
      />
      <Noise opacity={0.022} blendFunction={BlendFunction.ADD} />
      <Vignette offset={0.22} darkness={0.92} blendFunction={BlendFunction.NORMAL} />
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
        // After transition (~2.2s), enter interior + show overlay
        setTimeout(() => {
          advancePhase('interior');
          setShowOverlay(true);
        }, 2200);
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
    }, 2200);
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
            cursor: 'pointer', fontFamily: "'Open Sans', sans-serif",
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
