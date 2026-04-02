import { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import type { CubeModule } from '../App';
import { generateUnifiedRoofs, isSkeletonReady } from '../utils/roofAlgorithm';
import type { UnifiedRoof } from '../utils/roofAlgorithm';

interface RoofsRendererProps {
  cubes: CubeModule[];
}

export default function RoofsRenderer({ cubes }: RoofsRendererProps) {
  // force re-render when skeleton library loads
  const [ready, setReady] = useState(isSkeletonReady);
  useEffect(() => {
     if (!ready) {
        const interval = setInterval(() => {
           if (isSkeletonReady) {
              setReady(true);
              clearInterval(interval);
           }
        }, 100);
        return () => clearInterval(interval);
     }
  }, [ready]);

  const unifiedRoofs = useMemo(() => {
     return ready ? generateUnifiedRoofs(cubes) : [];
  }, [cubes, ready]);

  return (
    <group>
      {unifiedRoofs.map((roof, i) => (
        <UnifiedRoofMesh key={`uroof-${i}`} roof={roof} />
      ))}
    </group>
  );
}

function UnifiedRoofMesh({ roof }: { roof: UnifiedRoof }) {
  const geometry = useMemo(() => {
    const cellSize = 0.5;
    
    const positions: number[] = [];
    const indices: number[] = [];
    
    let vertexOffset = 0;

    roof.polygons3D.forEach(poly => {
       poly.forEach(pt => {
           positions.push(pt.x * cellSize, pt.y * cellSize, pt.z * cellSize);
       });
       
       const n = poly.length;
       for (let i = 1; i < n - 1; i++) {
           indices.push(vertexOffset, vertexOffset + i, vertexOffset + i + 1);
       }
       vertexOffset += n;
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    return geom;
  }, [roof]);

  const cellSize = 0.5;
  const worldY = roof.yBase * cellSize; 

  return (
    <group position={[0, worldY, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#475569" roughness={0.8} metalness={0.1} side={THREE.DoubleSide} />
        <Edges scale={1} threshold={30} color="#334155" />
      </mesh>
    </group>
  );
}
