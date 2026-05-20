import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Camera rig:
 *  'driving'  → follows car from the side (Z offset), car fills left half of frame
 *  'zooming'  → smooth dolly into blackbox POV inside windshield
 *  'interior' → locked to blackbox camera
 */
export default function CameraRig({ phase, carPosRef }) {
  const { camera } = useThree();
  const progress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const currentTarget = useRef(new THREE.Vector3());

  // Side-view offset from car: slightly behind, elevated, far to the side
  // Camera sits at car.x + SIDE_X, car.y + SIDE_Y, SIDE_Z
  const SIDE_X   =  1.5;   // slightly ahead of car center
  const SIDE_Y   =  1.4;   // eye-level height
  const SIDE_Z   =  7.0;   // distance to the side (Z axis)

  // Interior blackbox position (relative to car origin)
  const BB_LOCAL_POS    = new THREE.Vector3(0.55, 0.72, 0.1);
  const BB_LOCAL_TARGET = new THREE.Vector3(8, 0.72, 0);

  useEffect(() => {
    if (phase === 'driving') {
      camera.fov = 55;
      camera.updateProjectionMatrix();
    }
    if (phase === 'zooming') {
      progress.current = 0;
      startPos.current.copy(camera.position);
      // capture current look-at target
      const carX = carPosRef?.current ?? 0;
      startTarget.current.set(carX, SIDE_Y * 0.5, 0);
    }
  }, [phase]);

  useFrame((_, delta) => {
    const carX = carPosRef?.current ?? 0;

    if (phase === 'driving') {
      // Follow car: camera X tracks car X with a slight lag
      const targetCamX = carX + SIDE_X;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.08);
      camera.position.y = SIDE_Y;
      camera.position.z = SIDE_Z;

      // Look at car center
      const lookTarget = new THREE.Vector3(carX, 0.5, 0);
      camera.lookAt(lookTarget);
    }

    if (phase === 'zooming') {
      progress.current = Math.min(progress.current + delta * 0.5, 1);
      // Ease in-out cubic
      const t = progress.current < 0.5
        ? 4 * progress.current ** 3
        : 1 - (-2 * progress.current + 2) ** 3 / 2;

      // Interior target is relative to car position
      const interiorPos = new THREE.Vector3(
        carX + BB_LOCAL_POS.x,
        BB_LOCAL_POS.y,
        BB_LOCAL_POS.z,
      );
      const interiorTarget = new THREE.Vector3(
        carX + BB_LOCAL_TARGET.x,
        BB_LOCAL_TARGET.y,
        BB_LOCAL_TARGET.z,
      );

      camera.position.lerpVectors(startPos.current, interiorPos, t);
      currentTarget.current.lerpVectors(startTarget.current, interiorTarget, t);
      camera.lookAt(currentTarget.current);
      camera.fov = THREE.MathUtils.lerp(55, 72, t);
      camera.updateProjectionMatrix();
    }

    if (phase === 'interior') {
      const carX2 = carPosRef?.current ?? 0;
      camera.position.set(carX2 + BB_LOCAL_POS.x, BB_LOCAL_POS.y, BB_LOCAL_POS.z);
      camera.lookAt(carX2 + BB_LOCAL_TARGET.x, BB_LOCAL_TARGET.y, BB_LOCAL_TARGET.z);
      camera.fov = 72;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
