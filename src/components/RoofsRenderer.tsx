import { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import type { CubeModule } from '../App';
import { generateUnifiedRoofs, isSkeletonReady } from '../utils/roofAlgorithm';
import type { UnifiedRoof } from '../utils/roofAlgorithm';

interface RoofsRendererProps {
  cubes: CubeModule[];
}

function createRoofTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base saturated dark red teja color
  ctx.fillStyle = '#991b1b'; // Increased saturation (from Tailwind red-800)
  ctx.fillRect(0, 0, 512, 512);

  // Apply some noise for metal flake
  for (let i = 0; i < 20000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  // Seams (Junta alzada) - vertical lines
  const seamSpacing = 32; // distance between seams
  for (let x = 0; x <= 512; x += seamSpacing) {
      // Highlight (left side of seam)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(x - 1, 0, 1, 512);
      
      // Shadow (right side of seam)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(x, 0, 3, 512);
      
      // Seam ridge with lighter more visible saturated red
      ctx.fillStyle = '#dc2626'; // Tailwind red-600
      ctx.fillRect(x - 1, 0, 2, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8); // Seam frequency
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

const roofTex = createRoofTexture();

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
       // UV Projection logic
       // To adapt the texture lines to the slope, we map X and distance along slope.
       // A simpler global projection is just using X and Z.
       poly.forEach(pt => {
           positions.push(pt.x * cellSize, pt.y * cellSize, pt.z * cellSize);
           // We scale UVs to make seams have correct frequency
           uvs.push((pt.x * cellSize) / 2, (pt.z * cellSize) / 2);
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

    if (roof.skirts3D) {
      roof.skirts3D.forEach(poly => {
         poly.forEach(pt => {
             positions.push(pt.x * cellSize, pt.y * cellSize, pt.z * cellSize);
             uvs.push((pt.x + pt.z) * cellSize / 2, (pt.y * cellSize) / 2);
         });
         
         const n = poly.length;
         if (n >= 3) {
             const p0 = new THREE.Vector3(poly[0].x, poly[0].y, poly[0].z);
             const p1 = new THREE.Vector3(poly[1].x, poly[1].y, poly[1].z);
             const p2 = new THREE.Vector3(poly[n-1].x, poly[n-1].y, poly[n-1].z);
             
             const v1 = new THREE.Vector3().subVectors(p1, p0);
             const v2 = new THREE.Vector3().subVectors(p2, p0);
             const normal = new THREE.Vector3().crossVectors(v1, v2);
             
             const fixWinding = normal.y < 0;

             for (let i = 1; i < n - 1; i++) {
                 // Adjusting winding to ensure normal points outward (approx)
                 if (fixWinding) {
                     indices.push(vertexOffset, vertexOffset + i + 1, vertexOffset + i);
                 } else {
                     indices.push(vertexOffset, vertexOffset + i, vertexOffset + i + 1);
                 }
             }
         }
         vertexOffset += n;
      });
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    
    // Auto-generate secondary UVs for potential lightmaps or details
    geom.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));

    return geom;
  }, [roof]);

  const cellSize = 0.5;
  const worldY = roof.yBase * cellSize; 

  return (
    <group position={[0, worldY, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial 
            color="#b91c1c" // Tailwind red-700
            roughness={0.65} // slightly smoother to shine more
            metalness={0.3} 
            map={roofTex}
            side={THREE.DoubleSide} 
        />
        <Edges scale={1} threshold={30} color="#000000" />
      </mesh>
    </group>
  );
}
