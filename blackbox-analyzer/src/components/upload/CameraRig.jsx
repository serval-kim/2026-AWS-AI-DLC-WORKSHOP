import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Camera behaviour:
 *
 *  'driving'  → pure side view: camera at (carX, 1.2, 9), looking at (carX, 0.5, 0)
 *               Z=9 gives a true orthographic-like side profile.
 *               After ZOOM_DELAY ms, automatically starts zooming.
 *
 *  'zooming'  → smooth dolly from side position into blackbox POV inside windshield.
 *               Car keeps moving during zoom.
 *
 *  'interior' → camera locked to blackbox position, car stops, overlay appears.
 */
export default function CameraRig({ phase, carPosRef }) {
  const { camera } = useThree();

  // Zoom animation state
  const zoomProgress = useRef(0);
  const zoomStartPos = useRef(new THREE.Vector3());
  const zoomStartTarget = useRef(new THREE.Vector3());
  const lerpTarget = useRef(new THREE.Vector3());

  // Blackbox position relative to car origin
  // gltf car is rotated -90° Y, so gltf's +Z (front) → world -X (left)
  // Dashboard in gltf: ~(0.11, 0.85, 0.54) in gltf local → after -90°Y rotation:
  //   world_x = gltf_z * -1 = -0.54  (relative to car center)
  //   world_y = gltf_y      =  0.85
  //   world_z = gltf_x      =  0.11
  // Blackbox cam sits on windshield top-center
  const BB_OFFSET_POS  = new THREE.Vector3(-0.3,  0.85,  0.05);  // relative to car X
  const BB_OFFSET_LOOK = new THREE.Vector3(-12,   0.85,  0.05);  // looking forward (-X)

  // Side-view constants
  const SIDE_Z   = 9.0;   // true side — Z axis distance
  const SIDE_Y   = 1.2;   // slightly above wheel axle
  const LOOK_Y   = 0.55;  // look at car body center height

  useEffect(() => {
    if (phase === 'driving') {
      const cx = carPosRef.current;
      camera.position.set(cx, SIDE_Y, SIDE_Z);
      camera.lookAt(cx, LOOK_Y, 0);
      camera.fov = 42;   // narrower FOV = more telephoto, car fills frame
      camera.updateProjectionMatrix();
    }

    if (phase === 'zooming') {
      zoomProgress.current = 0;
      zoomStartPos.current.copy(camera.position);
      const cx = carPosRef.current;
      zoomStartTarget.current.set(cx, LOOK_Y, 0);
    }
  }, [phase]);

  useFrame((_, delta) => {
    const carX = carPosRef.current ?? 0;

    // ── DRIVING: pure side follow ──────────────────────────────────────────
    if (phase === 'driving') {
      // Snap X to car with very tight lag (feels like tracking shot)
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, carX, 0.12);
      camera.position.y = SIDE_Y;
      camera.position.z = SIDE_Z;
      camera.lookAt(carX, LOOK_Y, 0);
    }

    // ── ZOOMING: dolly into blackbox ───────────────────────────────────────
    if (phase === 'zooming') {
      zoomProgress.current = Math.min(zoomProgress.current + delta * 0.48, 1);

      // Ease-in-out cubic
      const p = zoomProgress.current;
      const t = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      // Target position moves with car
      const bbWorldPos = new THREE.Vector3(
        carX + BB_OFFSET_POS.x,
        BB_OFFSET_POS.y,
        BB_OFFSET_POS.z,
      );
      const bbWorldLook = new THREE.Vector3(
        carX + BB_OFFSET_LOOK.x,
        BB_OFFSET_LOOK.y,
        BB_OFFSET_LOOK.z,
      );

      // Also update start target to keep tracking car during zoom
      zoomStartTarget.current.set(carX, LOOK_Y, 0);

      camera.position.lerpVectors(zoomStartPos.current, bbWorldPos, t);
      lerpTarget.current.lerpVectors(zoomStartTarget.current, bbWorldLook, t);
      camera.lookAt(lerpTarget.current);

      // FOV widens slightly as we go inside (fisheye feel)
      camera.fov = THREE.MathUtils.lerp(42, 70, t);
      camera.updateProjectionMatrix();
    }

    // ── INTERIOR: locked, car stopped ─────────────────────────────────────
    if (phase === 'interior') {
      // carX is frozen by MovingCar when phase === 'interior'
      camera.position.set(
        carX + BB_OFFSET_POS.x,
        BB_OFFSET_POS.y,
        BB_OFFSET_POS.z,
      );
      camera.lookAt(
        carX + BB_OFFSET_LOOK.x,
        BB_OFFSET_LOOK.y,
        BB_OFFSET_LOOK.z,
      );
      camera.fov = 70;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
