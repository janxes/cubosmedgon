import { useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { CubeModule, Rotation3D, ToolType, ModuleType, WindowType, WindowAlign } from '../App';
import { getGridBounds } from '../App';
import * as THREE from 'three';

interface CubeProps {
  cube: CubeModule;
  activeTool: ToolType;
  activeRot: Rotation3D;
  activeWindowAlign: WindowAlign;
  selectedCubeId: string | null;
  selectedBounds: [number, number, number];
  isOccupied: (x: number, y: number, z: number, ignoreId?: string) => boolean;
  onAddCube: (gx: number, gy: number, gz: number, type: ModuleType, rot: Rotation3D) => void;
  onMoveCube: (id: string, gx: number, gy: number, gz: number) => void;
  onSelectCube: (id: string | null) => void;
  onRemoveCube: (id: string) => void;
  onAddWindow: (id: string, normalStr: string, wType: WindowType, align: WindowAlign) => void;
  onRemoveWindow: (id: string, normalStr: string) => void;
}

export default function Cube({ cube, activeTool, activeRot, activeWindowAlign, selectedCubeId, selectedBounds, isOccupied, onAddCube, onMoveCube, onSelectCube, onRemoveCube, onAddWindow, onRemoveWindow }: CubeProps) {
  const [hovered, setHovered] = useState(false);
  const isSelected = cube.id === selectedCubeId;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const normal = e.face?.normal;
    if (!normal) return;

    const normalStr = `${Math.round(normal.x)},${Math.round(normal.y)},${Math.round(normal.z)}`;

    // Selection or Move tool
    if (activeTool === 'SELECT') {
      if (!selectedCubeId) {
        onSelectCube(cube.id); // Select
      } else if (selectedCubeId === cube.id) {
        onSelectCube(null); // Deselect
      } else {
        // Move selected cube onto this cube's face!
        const [cw, ch, cd] = getGridBounds(cube.type, cube.rot);
        const [nw, nh, nd] = selectedBounds;

        let newMinX = cube.pos[0];
        let newMinY = cube.pos[1];
        let newMinZ = cube.pos[2];

        if (Math.abs(normal.x) > 0.5) newMinX = normal.x > 0 ? cube.pos[0] + cw : cube.pos[0] - nw;
        else if (Math.abs(normal.y) > 0.5) newMinY = normal.y > 0 ? cube.pos[1] + ch : cube.pos[1] - nh;
        else if (Math.abs(normal.z) > 0.5) newMinZ = normal.z > 0 ? cube.pos[2] + cd : cube.pos[2] - nd;

        if (newMinY < 0) return;

        let collision = false;
        for (let dx = 0; dx < nw; dx++) {
          for (let dy = 0; dy < nh; dy++) {
            for (let dz = 0; dz < nd; dz++) {
              if (isOccupied(newMinX+dx, newMinY+dy, newMinZ+dz, selectedCubeId)) collision = true;
            }
          }
        }
        
        if (!collision) {
          onMoveCube(selectedCubeId, newMinX, newMinY, newMinZ);
          onSelectCube(null); // drop selection after move
        }
      }
      return;
    }

    if (activeTool === 'ERASE' || e.button === 2) {
      if (cube.windows && cube.windows[normalStr]) {
        onRemoveWindow(cube.id, normalStr);
      } else {
        onRemoveCube(cube.id);
      }
      return;
    }

    if (activeTool.startsWith('W_')) {
      const wType = activeTool.split('_')[1].toLowerCase() as WindowType;
      onAddWindow(cube.id, normalStr, wType, activeWindowAlign);
      return;
    }

    if (activeTool === 'A' || activeTool === 'B') {
      const activeMod = activeTool as ModuleType;
      const [cw, ch, cd] = getGridBounds(cube.type, cube.rot);
      const [nw, nh, nd] = getGridBounds(activeMod, activeRot);

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
        onAddCube(newMinX, newMinY, newMinZ, activeMod, activeRot);
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

  const color = isSelected ? '#fcd34d' : (cube.color || (cube.type === 'A' ? '#f8fafc' : '#cbd5e1'));
  const edgeColor = isSelected ? '#ea580c' : '#94a3b8';
  const args: [number, number, number] = cube.type === 'B' ? [0.5, 1, 1] : [1, 1, 1];

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
        <meshStandardMaterial color={hovered && !isSelected && (activeTool === 'A' || activeTool === 'B' || activeTool === 'SELECT') ? '#fbbf24' : color} roughness={0.2} metalness={0.1}/>
        <Edges scale={1} threshold={15} color={edgeColor} />
      </mesh>

      {/* Render Painted Windows */}
      {cube.windows && Object.entries(cube.windows).map(([normalStr, wData]) => {
        const [nx, ny, nz] = normalStr.split(',').map(Number);
        
        let rotX = 0, rotY = 0, rotZ = 0;
        if (nx === 1) rotY = Math.PI / 2;
        if (nx === -1) rotY = -Math.PI / 2;
        if (ny === 1) rotX = -Math.PI / 2;
        if (ny === -1) rotX = Math.PI / 2;
        if (nz === 1) rotY = 0;
        if (nz === -1) rotY = Math.PI;

        const wMultiplier = wData.type === 'full' ? 0.95 : wData.type === 'half' ? 0.50 : 0.33;
        
        let planeW = wMultiplier;
        let planeH = args[1] * 0.75;

        let localFaceWidth = 1;

        if (nx !== 0) { planeW *= args[2]; localFaceWidth = args[2]; } 
        else if (nz !== 0) { planeW *= args[0]; localFaceWidth = args[0]; } 
        else if (ny !== 0) { planeW *= args[0]; planeH = args[2] * 0.75; localFaceWidth = args[0]; } 

        let px = nx * (args[0] / 2 + 0.001);
        let py = ny * (args[1] / 2 + 0.001);
        let pz = nz * (args[2] / 2 + 0.001);

        if (wData.align === 'left' || wData.align === 'right') {
           const gap = localFaceWidth - planeW;
           let shift = gap / 2;
           // FIXED inversions! Left actually shifts -shift, right shifts +shift properly!
           if (wData.align === 'left') shift = -shift;

           if (nx === 1) { pz += shift; }
           if (nx === -1) { pz -= shift; }
           if (nz === 1) { px += shift; }
           if (nz === -1) { px -= shift; }
        }

        return (
          <mesh 
            key={normalStr} 
            position={[px, py, pz]} 
            rotation={[rotX, rotY, rotZ]}
            onPointerOver={(e) => { if(activeTool === 'ERASE'){ e.stopPropagation(); setHovered(true); }}}
          >
            <planeGeometry args={[planeW, planeH]} />
            <meshStandardMaterial color={hovered && activeTool === 'ERASE' ? '#ef4444' : '#0ea5e9'} roughness={0.1} metalness={0.9} transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}
