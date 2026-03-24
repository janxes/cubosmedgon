import type { ThreeEvent } from '@react-three/fiber';
import type { CubeModule, Rotation3D } from '../App';
import type { ModuleType } from './UIOverlay';
import { getGridBounds } from '../App';
import Cube from './Cube';

interface SceneProps {
  cubes: CubeModule[];
  onAddCube: (gx: number, gy: number, gz: number, type: ModuleType, rot: Rotation3D) => void;
  onRemoveCube: (id: string) => void;
  activeModuleType: ModuleType;
  activeRot: Rotation3D;
  isOccupied: (x: number, y: number, z: number) => boolean;
}

export default function Scene({ cubes, onAddCube, onRemoveCube, activeModuleType, activeRot, isOccupied }: SceneProps) {
  
  const handlePlaneClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const cellX = Math.floor(e.point.x / 0.5);
    const cellZ = Math.floor(e.point.z / 0.5);
    
    // Snap to even multiples to align neatly with defaults
    const gx = cellX % 2 === 0 ? cellX : cellX - 1;
    const gz = cellZ % 2 === 0 ? cellZ : cellZ - 1;
    const gy = 0; 
    
    // check bounds collision
    const [w, h, d] = getGridBounds(activeModuleType, activeRot);
    let collision = false;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        for (let dz = 0; dz < d; dz++) {
          if (isOccupied(gx+dx, gy+dy, gz+dz)) collision = true;
        }
      }
    }
    
    if (!collision) {
      onAddCube(gx, gy, gz, activeModuleType, activeRot);
    }
  };

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
          onAdd={onAddCube}
          onRemove={onRemoveCube}
          activeModuleType={activeModuleType}
          activeRot={activeRot}
          isOccupied={isOccupied}
        />
      ))}
    </>
  );
}
