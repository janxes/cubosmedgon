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
    const uvs: number[] = [];
    
    let vertexOffset = 0;

    roof.polygons3D.forEach(poly => {
       poly.forEach(pt => {
           positions.push(pt.x * cellSize, pt.y * cellSize, pt.z * cellSize);
           // Planar mapping for UVs based on local X and Z
           uvs.push(pt.x * 0.5, pt.z * 0.5);
       });
       
       const n = poly.length;
       if (n >= 3) {
           // Compute normal to check winding order
           const p0 = new THREE.Vector3(poly[0].x, poly[0].y, poly[0].z);
           const p1 = new THREE.Vector3(poly[1].x, poly[1].y, poly[1].z);
           const p2 = new THREE.Vector3(poly[n-1].x, poly[n-1].y, poly[n-1].z);
           
           const v1 = new THREE.Vector3().subVectors(p1, p0);
           const v2 = new THREE.Vector3().subVectors(p2, p0);
           const normal = new THREE.Vector3().crossVectors(v1, v2);
           
           // If the normal points downwards, we need to flip the triangle winding
           const fixWinding = normal.y < 0;

           for (let i = 1; i < n - 1; i++) {
               if (fixWinding) {
                   indices.push(vertexOffset, vertexOffset + i + 1, vertexOffset + i);
               } else {
                   indices.push(vertexOffset, vertexOffset + i, vertexOffset + i + 1);
               }
           }
       }
       vertexOffset += n;
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    return geom;
  }, [roof]);

  const cellSize = 0.5;
  const worldY = roof.yBase * cellSize; 

  return (
    <group position={[0, worldY, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial 
            color="#334155" 
            roughness={0.9} 
            metalness={0.0} 
            side={THREE.FrontSide} // FrontSide is optimal now that normals are consistent
        />
        <Edges scale={1} threshold={30} color="#0f172a" />
      </mesh>
    </group>
  );
}
