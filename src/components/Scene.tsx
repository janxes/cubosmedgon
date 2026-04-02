import type { ThreeEvent } from '@react-three/fiber';
import type { CubeModule, Rotation3D, ToolType, ModuleType, WindowType, WindowAlign } from '../App';
import { getGridBounds } from '../App';
import Cube from './Cube';
import RoofsRenderer from './RoofsRenderer';

interface SceneProps {
  cubes: CubeModule[];
  activeTool: ToolType;
  activeRot: Rotation3D;
  activeWindowType: WindowType;
  activeWindowAlign: WindowAlign;
  selectedCubeId: string | null;
  isOccupied: (x: number, y: number, z: number, ignoreId?: string) => boolean;
  onAddCube: (gx: number, gy: number, gz: number, type: ModuleType, rot: Rotation3D) => void;
  onMoveCube: (id: string, gx: number, gy: number, gz: number) => void;
  onSelectCube: (id: string | null) => void;
  onRemoveCube: (id: string) => void;
  onAddWindow: (id: string, normalStr: string, wType: WindowType, align: WindowAlign) => void;
  onRemoveWindow: (id: string, normalStr: string) => void;
  onToggleRoof: (id: string) => void;
  snapGrid: 3.0 | 1.5;
}

export default function Scene({ 
  cubes, activeTool, activeRot, activeWindowType, activeWindowAlign, selectedCubeId, 
  isOccupied, onAddCube, onMoveCube, onSelectCube, onRemoveCube, 
  onAddWindow, onRemoveWindow, onToggleRoof, snapGrid
}: SceneProps) {
  
  const handlePlaneClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();

    let gx = Math.floor(e.point.x / 0.5);
    let gz = Math.floor(e.point.z / 0.5);
    if (snapGrid === 3.0) {
      gx = gx % 2 === 0 ? gx : gx - 1;
      gz = gz % 2 === 0 ? gz : gz - 1;
    }
    const gy = 0; 
    
    if (activeTool === 'SELECT') {
      if (selectedCubeId) {
        onMoveCube(selectedCubeId, gx, gy, gz);
        onSelectCube(null); // drop selection after move
      } else {
        onSelectCube(null);
      }
      return;
    }

    if (activeTool !== 'A' && activeTool !== 'B') return;

    // check bounds collision
    const [w, h, d] = getGridBounds(activeTool as ModuleType, activeRot);
    let collision = false;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        for (let dz = 0; dz < d; dz++) {
          if (isOccupied(gx+dx, gy+dy, gz+dz)) collision = true;
        }
      }
    }
    
    if (!collision) {
      onAddCube(gx, gy, gz, activeTool as ModuleType, activeRot);
    }
  };

  const selectedCube = cubes.find(c => c.id === selectedCubeId);
  const selectedBounds = selectedCube ? getGridBounds(selectedCube.type, selectedCube.rot) : [1,1,1];

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onClick={handlePlaneClick}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1e293b" opacity={0.8} transparent />
      </mesh>
      <gridHelper args={[100, 100, '#334155', '#1e293b']} position={[0, 0.01, 0]} />
      {cubes.map((cube) => (
        <Cube 
          key={cube.id} 
          cube={cube}
          activeTool={activeTool}
          activeRot={activeRot}
          activeWindowType={activeWindowType}
          activeWindowAlign={activeWindowAlign}
          selectedCubeId={selectedCubeId}
          selectedBounds={selectedBounds as [number, number, number]}
          isOccupied={isOccupied}
          onAddCube={onAddCube}
          onMoveCube={onMoveCube}
          onSelectCube={onSelectCube}
          onRemoveCube={onRemoveCube}
          onAddWindow={onAddWindow}
          onRemoveWindow={onRemoveWindow}
          onToggleRoof={onToggleRoof}
        />
      ))}
      <RoofsRenderer cubes={cubes} />
    </>
  );
}
