import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Two-phase camera rig:
 *  Phase 'driving'  → exterior side view, slightly elevated, car moving left
 *  Phase 'zooming'  → smooth transition into car interior (blackbox POV)
 *  Phase 'interior' → locked to blackbox camera position inside windshield
 */
export default function CameraRig({ phase }) {
  const { camera } = useThree();
  const progress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());

  // Target positions
  const EXTERIOR_POS    = new THREE.Vector3(0, 2.2, 9);
  const EXTERIOR_TARGET = new THREE.Vector3(0, 0.5, 0);
  const INTERIOR_POS    = new THREE.Vector3(0.55, 0.72, 0.3);   // blackbox cam position
  const INTERIOR_TARGET = new THREE.Vector3(6, 0.72, 0);        // looking forward (left = +x in scene)

  useEffect(() => {
    if (phase === 'driving') {
      camera.position.copy(EXTERIOR_POS);
      camera.lookAt(EXTERIOR_TARGET);
    }
    if (phase === 'zooming') {
      progress.current = 0;
      startPos.current.copy(camera.position);
      startTarget.current.copy(EXTERIOR_TARGET);
    }
  }, [phase]);

  const currentTarget = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (phase === 'driving') {
      // Gentle float
      const t = Date.now() * 0.0008;
      camera.position.set(
        EXTERIOR_POS.x + Math.sin(t * 0.4) * 0.15,
        EXTERIOR_POS.y + Math.sin(t * 0.6) * 0.08,
        EXTERIOR_POS.z + Math.sin(t * 0.3) * 0.1,
      );
      camera.lookAt(EXTERIOR_TARGET);
    }

    if (phase === 'zooming') {
      progress.current = Math.min(progress.current + delta * 0.55, 1);
      // Ease in-out cubic
      const t = progress.current < 0.5
        ? 4 * progress.current ** 3
        : 1 - (-2 * progress.current + 2) ** 3 / 2;

      camera.position.lerpVectors(startPos.current, INTERIOR_POS, t);
      currentTarget.current.lerpVectors(startTarget.current, INTERIOR_TARGET, t);
      camera.lookAt(currentTarget.current);
      camera.fov = THREE.MathUtils.lerp(60, 75, t);
      camera.updateProjectionMatrix();
    }

    if (phase === 'interior') {
      camera.position.copy(INTERIOR_POS);
      camera.lookAt(INTERIOR_TARGET);
      camera.fov = 75;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
