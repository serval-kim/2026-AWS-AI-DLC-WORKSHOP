import React, { useRef, useMemo, useEffect, Component } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Silence texture 404s — textures aren't needed for wireframe rendering
THREE.DefaultLoadingManager.onError = () => {};

// Configure Draco decoder (CDN)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

// ─── Constants ────────────────────────────────────────────────────────────────

const WHEEL_NAMES = new Set([
  'Tire FL', 'Tire FR', 'Tire RL', 'Tire RR',
  'Rim FL', 'Rim FR', 'Rim RL', 'Rim RR',
  'Rim Bolt FL', 'Rim Bolt FR', 'Rim Bolt RL', 'Rim Bolts RR',
  'Brake Disc FL', 'Brake Disc FR', 'Brake Disc RL', 'Brake Disc RR',
  'Wheelhub FL', 'Wheelhub FR', 'Wheelhub RL', 'Wheelhub RR',
  'Caliper FL', 'Caliper FR', 'Caliper RL', 'Caliper RR',
  'Rim Emblem FL', 'Rim Emblem FR', 'Rim Emblem RL', 'Rim Emblem RR',
]);

const HEADLIGHT_NAMES = new Set([
  'Emitters Headlight', 'Glass Headlight', 'Glass Runninglight',
  'Glass Turnsignal', 'Reflector Headlight 1', 'Reflector Headlight 2',
  'Reflector Highbeam', 'Reflector Runninglight',
]);

const TAILLIGHT_NAMES = new Set([
  'Taillight glass', 'Diffusers Taillight', 'Diffuser 3 Taillight',
  'Diffuser TrunkTaillight', 'Diffuser ReverseLight',
  'MainReflectors Taillight', 'Reflector 2 Taillight',
]);

const C_BODY      = '#00e5ff';
const C_DIM       = '#005566';
const C_GLASS     = '#002233';
const C_WHEEL     = '#0099bb';
const C_HEADLIGHT = '#ffffff';
const C_TAILLIGHT = '#ff3300';

// ─── Material cache (avoid recreating every frame) ───────────────────────────
const matCache = {};
function getLineMat(color, opacity = 1) {
  const key = `${color}_${opacity}`;
  if (!matCache[key]) {
    matCache[key] = new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
    });
  }
  return matCache[key];
}
const matHeadlight = new THREE.MeshBasicMaterial({ color: C_HEADLIGHT });
const matTaillight = new THREE.MeshBasicMaterial({ color: C_TAILLIGHT });

// ─── GLTF wireframe car ───────────────────────────────────────────────────────
function GltfCar({ phase }) {
  const { scene } = useGLTF('/car.gltf', true); // true = use Draco
  const rootRef = useRef();
  const wheelObjects = useRef([]);

  // Clone scene once and convert all meshes to wireframe lines
  const wireScene = useMemo(() => {
    const root = scene.clone(true);

    root.traverse(obj => {
      if (!obj.isMesh) return;

      const name = obj.name;

      // Solid emissive for lights
      if (HEADLIGHT_NAMES.has(name)) {
        obj.material = matHeadlight;
        return;
      }
      if (TAILLIGHT_NAMES.has(name)) {
        obj.material = matTaillight;
        return;
      }

      // Determine line color
      const isGlass  = name.toLowerCase().includes('glass') ||
                       name.toLowerCase().includes('windsh') ||
                       name.toLowerCase().includes('sunroof');
      const isWheel  = WHEEL_NAMES.has(name);
      const isDim    = name.includes('Underbody') || name.includes('Floor') ||
                       name.includes('Shell') || name.includes('Carpet') ||
                       name.includes('Seat') || name.includes('Dashboard') ||
                       name.includes('Console') || name.includes('Steering');

      const color   = isGlass ? C_GLASS : isWheel ? C_WHEEL : isDim ? C_DIM : C_BODY;
      const opacity = isGlass ? 0.3 : 1.0;

      // Build edges geometry
      try {
        const edges = new THREE.EdgesGeometry(obj.geometry, 15);
        obj.geometry = edges;
        obj.material = getLineMat(color, opacity);
        // Recast as LineSegments
        obj.type = 'LineSegments';
        obj.isLine = true;
        obj.isLineSegments = true;
        obj.isMesh = false;
      } catch {
        // If geometry conversion fails, just hide the mesh
        obj.visible = false;
      }
    });

    return root;
  }, [scene]);

  // Collect wheel objects after mount
  useEffect(() => {
    if (!rootRef.current) return;
    const wheels = [];
    rootRef.current.traverse(obj => {
      if (WHEEL_NAMES.has(obj.name)) wheels.push(obj);
    });
    wheelObjects.current = wheels;
  }, [wireScene]);

  // Spin wheels
  useFrame((_, delta) => {
    if (phase === 'interior') return;
    // gltf car faces +Z, so wheels spin around Z axis
    wheelObjects.current.forEach(obj => {
      obj.rotation.z -= delta * 8;
    });
  });

  // gltf is centered around origin but may need Y adjustment
  // Inspect: car body sits at ~y=0.38 in gltf units
  return (
    <group ref={rootRef}>
      <primitive object={wireScene} />
      {/* Headlight glow */}
      <pointLight position={[0, 0.5,  2.6]} color="#ffffff" intensity={8} distance={16} decay={2} />
      <pointLight position={[0, 0.5, -2.6]} color="#ff3300" intensity={6} distance={10} decay={2} />
    </group>
  );
}

// ─── Error boundary so a missing texture doesn't crash the whole app ─────────
class CarErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <FallbackCar phase={this.props.phase} />;
    return this.props.children;
  }
}

// ─── Fallback procedural car ──────────────────────────────────────────────────
function FallbackCar({ phase }) {
  const wheelRefs = [useRef(), useRef(), useRef(), useRef()];

  useFrame((_, delta) => {
    if (phase !== 'interior') {
      wheelRefs.forEach(r => { if (r.current) r.current.rotation.x -= delta * 9; });
    }
  });

  const LineBox = ({ args, pos, rot, color = C_BODY, opacity = 1 }) => {
    const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...args)), []);
    return (
      <lineSegments geometry={geo} position={pos} rotation={rot}>
        <lineBasicMaterial color={color} transparent opacity={opacity} />
      </lineSegments>
    );
  };

  return (
    <group>
      <LineBox args={[4.3, 0.58, 1.85]} pos={[0, 0.30, 0]} />
      <LineBox args={[2.3, 0.54, 1.68]} pos={[0.05, 0.84, 0]} />
      <LineBox args={[2.0, 0.20, 1.60]} pos={[0.05, 1.06, 0]} color={C_DIM} />
      <LineBox args={[0.07, 0.66, 1.56]} pos={[1.22, 0.80, 0]} rot={[0,0,-0.5]} color={C_GLASS} opacity={0.4} />
      <LineBox args={[0.07, 0.66, 1.56]} pos={[-1.05, 0.80, 0]} rot={[0,0,0.5]} color={C_GLASS} opacity={0.4} />
      <LineBox args={[1.25, 0.13, 1.78]} pos={[1.85, 0.44, 0]} rot={[0,0,0.07]} color={C_DIM} />
      <LineBox args={[0.85, 0.16, 1.78]} pos={[-1.72, 0.48, 0]} color={C_DIM} />
      <LineBox args={[0.14, 0.30, 1.78]} pos={[2.18, 0.20, 0]} color={C_DIM} />
      <LineBox args={[0.14, 0.30, 1.78]} pos={[-2.18, 0.20, 0]} color={C_DIM} />
      <mesh position={[2.16, 0.34, 0.64]}><boxGeometry args={[0.09,0.16,0.36]}/><meshBasicMaterial color={C_HEADLIGHT}/></mesh>
      <mesh position={[2.16, 0.34,-0.64]}><boxGeometry args={[0.09,0.16,0.36]}/><meshBasicMaterial color={C_HEADLIGHT}/></mesh>
      <pointLight position={[2.7, 0.34, 0]} color="#ffffff" intensity={6} distance={14} decay={2} />
      <mesh position={[-2.16, 0.34, 0.64]}><boxGeometry args={[0.09,0.18,0.42]}/><meshBasicMaterial color={C_TAILLIGHT}/></mesh>
      <mesh position={[-2.16, 0.34,-0.64]}><boxGeometry args={[0.09,0.18,0.42]}/><meshBasicMaterial color={C_TAILLIGHT}/></mesh>
      <pointLight position={[-2.6, 0.34, 0]} color="#ff2200" intensity={5} distance={8} decay={2} />
      {[[1.25,-0.03,1.02],[1.25,-0.03,-1.02],[-1.25,-0.03,1.02],[-1.25,-0.03,-1.02]].map((p,i) => (
        <group key={i} position={p} ref={wheelRefs[i]} rotation={[0,0,Math.PI/2]}>
          <lineSegments>
            <edgesGeometry args={[new THREE.CylinderGeometry(0.33,0.33,0.24,20)]} />
            <lineBasicMaterial color={C_WHEEL} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────
export default function CarModel({ phase }) {
  return (
    <CarErrorBoundary phase={phase}>
      <GltfCar phase={phase} />
    </CarErrorBoundary>
  );
}

useGLTF.preload('/car.gltf', true);
