import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Wire-style road — grid lines on black */
export default function Road({ speed = 1 }) {
  const dashGroupRef = useRef();
  const offset = useRef(0);

  useFrame((_, delta) => {
    if (speed > 0) {
      offset.current = (offset.current + delta * speed * 7) % 4;
      if (dashGroupRef.current) {
        dashGroupRef.current.position.x = offset.current;
      }
    }
  });

  const C_ROAD  = '#003344';
  const C_DASH  = '#006688';
  const C_EDGE  = '#00aacc';
  const C_GRID  = '#001a22';

  // Road surface as a flat line-grid
  const gridGeo = useMemo(() => {
    const pts = [];
    // Longitudinal lines
    for (let z = -4; z <= 4; z += 1) {
      pts.push(-60, -0.35, z,  60, -0.35, z);
    }
    // Cross lines every 4 units
    for (let x = -60; x <= 60; x += 4) {
      pts.push(x, -0.35, -4,  x, -0.35, 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);

  // Edge lines geometry
  const edgeGeoL = useMemo(() => {
    const pts = [-60, -0.34, 2.7,  60, -0.34, 2.7];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const edgeGeoR = useMemo(() => {
    const pts = [-60, -0.34, -2.7,  60, -0.34, -2.7];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <group>
      {/* Road grid */}
      <lineSegments geometry={gridGeo}>
        <lineBasicMaterial color={C_GRID} transparent opacity={0.4} />
      </lineSegments>

      {/* Edge lines */}
      <line geometry={edgeGeoL}>
        <lineBasicMaterial color={C_EDGE} transparent opacity={0.9} />
      </line>
      <line geometry={edgeGeoR}>
        <lineBasicMaterial color={C_EDGE} transparent opacity={0.9} />
      </line>

      {/* Scrolling center dashes */}
      <group ref={dashGroupRef}>
        {Array.from({ length: 32 }).map((_, i) => {
          const pts = [-62 + i * 4, -0.34, 0,  -62 + i * 4 + 2.0, -0.34, 0];
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
          return (
            <line key={i} geometry={g}>
              <lineBasicMaterial color={C_DASH} transparent opacity={0.7} />
            </line>
          );
        })}
      </group>

      {/* Ground plane — pure black */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.38, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}
