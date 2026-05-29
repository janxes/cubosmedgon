import { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import type { CubeModule } from '../App';
import { generateUnifiedRoofs, isSkeletonReady } from '../utils/roofAlgorithm';
import type { UnifiedRoof } from '../utils/roofAlgorithm';

interface RoofsRendererProps {
  cubes: CubeModule[];
  pitchPercent: number;
  roofRot: number;
}

function createRoofTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#991b1b'; 
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 20000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  const seamSpacing = 32; 
  for (let x = 0; x <= 512; x += seamSpacing) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(x - 1, 0, 1, 512);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(x, 0, 3, 512);
      ctx.fillStyle = '#dc2626'; 
      ctx.fillRect(x - 1, 0, 2, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12); 
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

const roofTex = createRoofTexture();

export default function RoofsRenderer({ cubes, pitchPercent, roofRot }: RoofsRendererProps) {
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
     return ready ? generateUnifiedRoofs(cubes, pitchPercent, roofRot) : [];
  }, [cubes, pitchPercent, roofRot, ready]);

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
       const rType = (poly as any).roofType || 'hip';
       
       poly.forEach(pt => {
           positions.push(pt.x * cellSize, pt.y * cellSize, pt.z * cellSize);
           
           let ux = (pt.x * cellSize) / 2;
           let uz = (pt.z * cellSize) / 2;

           // ROTATE UVS based on roof orientation so seams follow the slope
           if (rType.includes('_e') || rType.includes('_w')) {
               // Swap UVs for East/West to align seams with X axis
               uvs.push(uz, ux);
           } else {
               // Normal UVs for North/South
               uvs.push(ux, uz);
           }
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
               if (fixWinding) indices.push(vertexOffset, vertexOffset + i + 1, vertexOffset + i);
               else indices.push(vertexOffset, vertexOffset + i, vertexOffset + i + 1);
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
                 if (fixWinding) indices.push(vertexOffset, vertexOffset + i + 1, vertexOffset + i);
                 else indices.push(vertexOffset, vertexOffset + i, vertexOffset + i + 1);
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
    return geom;
  }, [roof]);

  const worldY = roof.yBase * 0.5; 

  return (
    <group position={[0, worldY, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#991b1b" roughness={0.6} metalness={0.4} map={roofTex} side={THREE.DoubleSide} />
        <Edges scale={1} threshold={30} color="#000000" />
      </mesh>
    </group>
  );
}
