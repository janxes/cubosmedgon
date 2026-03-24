import { useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { CubeModule, Rotation3D } from '../App';
import type { ModuleType } from './UIOverlay';
import { getGridBounds } from '../App';
import * as THREE from 'three';

interface CubeProps {
  cube: CubeModule;
  onAdd: (gx: number, gy: number, gz: number, type: ModuleType, rot: Rotation3D) => void;
  onRemove: (id: string) => void;
  activeModuleType: ModuleType;
  activeRot: Rotation3D;
  isOccupied: (x: number, y: number, z: number) => boolean;
}

export default function Cube({ cube, onAdd, onRemove, activeModuleType, activeRot, isOccupied }: CubeProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.button === 2) {
      onRemove(cube.id);
      return;
    }

    if (e.face) {
      const normal = e.face.normal;
      const [cw, ch, cd] = getGridBounds(cube.type, cube.rot);
      const [nw, nh, nd] = getGridBounds(activeModuleType, activeRot);

      let newMinX = cube.pos[0];
      let newMinY = cube.pos[1];
      let newMinZ = cube.pos[2];

      if (Math.abs(normal.x) > 0.5) {
        newMinX = normal.x > 0 ? cube.pos[0] + cw : cube.pos[0] - nw;
      } else if (Math.abs(normal.y) > 0.5) {
        newMinY = normal.y > 0 ? cube.pos[1] + ch : cube.pos[1] - nh;
      } else if (Math.abs(normal.z) > 0.5) {
        newMinZ = normal.z > 0 ? cube.pos[2] + cd : cube.pos[2] - nd;
      }

      if (newMinY < 0) return;

      let collision = false;
      for (let dx = 0; dx < nw; dx++) {
        for (let dy = 0; dy < nh; dy++) {
          for (let dz = 0; dz < nd; dz++) {
            if (isOccupied(newMinX+dx, newMinY+dy, newMinZ+dz)) collision = true;
          }
        }
      }
      
      if (!collision) {
        onAdd(newMinX, newMinY, newMinZ, activeModuleType, activeRot);
      }
    }
  };

  const [cw, ch, cd] = getGridBounds(cube.type, cube.rot);
  const worldX = (cube.pos[0] + cw / 2) * 0.5;
  const worldY = (cube.pos[1] + ch / 2) * 0.5;
  const worldZ = (cube.pos[2] + cd / 2) * 0.5;
  
  const rotRad: [number, number, number] = [
    cube.rot[0] * Math.PI / 180,
    cube.rot[1] * Math.PI / 180,
    cube.rot[2] * Math.PI / 180,
  ];

  const color = cube.color || (cube.type === 'A' ? '#f8fafc' : cube.type === 'B' ? '#cbd5e1' : '#e2e8f0');

  let args: [number, number, number] = [1, 1, 1];
  if (cube.type === 'B') args = [0.5, 1, 1];

  return (
    <group 
      position={[worldX, worldY, worldZ]}
      rotation={rotRad}
      onClick={handleClick}
      onContextMenu={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={hovered ? '#fbbf24' : color} roughness={0.2} metalness={0.1}/>
        <Edges scale={1} threshold={15} color="#94a3b8" />
      </mesh>

      {cube.type === 'C' && (
        <mesh position={[0, 0, 0.501]}>
          <planeGeometry args={[0.95, 0.95]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.1} metalness={0.9} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {cube.type === 'D' && (
        <mesh position={[0, 0, 0.501]}>
          <planeGeometry args={[0.95, 0.45]} />
          <meshStandardMaterial color="#0ea5e9" roughness={0.1} metalness={0.9} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
