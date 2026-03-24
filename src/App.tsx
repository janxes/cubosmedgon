import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';
import type { ModuleType } from './components/UIOverlay';

export type Rotation3D = [number, number, number]; // Euler degrees 0, 90, 180, 270

export type CubeModule = {
  id: string;
  pos: [number, number, number]; // [minX, minY, minZ] in 1.5m grid units
  type: ModuleType;
  rot: Rotation3D;
  color?: string;
};

export const MODULE_PRICES: Record<ModuleType, number> = {
  'A': 15000,
  'B': 7500,
  'C': 20000,
  'D': 18500,
};

export const getGridBounds = (type: ModuleType, rot: Rotation3D): [number, number, number] => {
  if (type === 'A' || type === 'C' || type === 'D') return [2, 2, 2];
  let w = 1, h = 2, d = 2; // Default B bounds (1.5 width, 3 height, 3 depth)
  const [, ry, ] = rot;
  if (ry % 180 !== 0) { const t = w; w = d; d = t; }
  return [w, h, d];
};

function App() {
  const [activeModuleType, setActiveModuleType] = useState<ModuleType>('B');
  const [activeRot, setActiveRot] = useState<Rotation3D>([0, 0, 0]);

  const [cubes, setCubes] = useState<CubeModule[]>([
    { id: 'initial', pos: [0, 0, 0], type: 'A', rot: [0, 0, 0] }
  ]);

  const cellMap = new Map<string, string>();
  cubes.forEach(c => {
    const [w, h, d] = getGridBounds(c.type, c.rot);
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        for (let dz = 0; dz < d; dz++) {
          cellMap.set(`${c.pos[0]+dx},${c.pos[1]+dy},${c.pos[2]+dz}`, c.id);
        }
      }
    }
  });

  const isOccupied = (x: number, y: number, z: number) => cellMap.has(`${x},${y},${z}`);

  // Calculate surfaces accurately
  const calculateSurfaces = () => {
    let roofFaces = 0, floorFaces = 0, slabFaces = 0, wallFaces = 0;

    cellMap.forEach((cubeId, key) => {
      const [x, y, z] = key.split(',').map(Number);
      
      if (!isOccupied(x, y + 1, z)) roofFaces++;
      
      const belowId = cellMap.get(`${x},${y - 1},${z}`);
      if (!belowId) floorFaces++;
      else if (belowId !== cubeId) slabFaces++;
      
      if (!isOccupied(x + 1, y, z)) wallFaces++;
      if (!isOccupied(x - 1, y, z)) wallFaces++;
      if (!isOccupied(x, y, z + 1)) wallFaces++;
      if (!isOccupied(x, y, z - 1)) wallFaces++;
    });

    // Each cell is 1.5m x 1.5m = 2.25 sqm
    return {
      roofArea: roofFaces * 2.25,
      floorArea: floorFaces * 2.25,
      slabArea: slabFaces * 2.25,
      wallArea: wallFaces * 2.25,
      totalArea: (roofFaces + floorFaces + slabFaces + wallFaces) * 2.25
    };
  };

  const surfaces = calculateSurfaces();
  
  const getFloorsCount = () => {
    if (cubes.length === 0) return 0;
    let maxTopY = 0;
    cubes.forEach(c => {
      const h = getGridBounds(c.type, c.rot)[1];
      const topY = c.pos[1] + h;
      if (topY > maxTopY) maxTopY = topY;
    });
    // 2 cells = 1 floor (3m)
    return Math.ceil(maxTopY / 2);
  };
  const floors = getFloorsCount();
  const totalBudget = cubes.reduce((acc, c) => acc + MODULE_PRICES[c.type], 0);

  const resetProject = () => {
    setCubes([{ id: 'initial', pos: [0, 0, 0], type: 'A', rot: [0, 0, 0] }]);
  };

  const addCube = (gx: number, gy: number, gz: number, type: ModuleType, rot: Rotation3D) => {
    setCubes(prev => [...prev, { id: Date.now().toString(), pos: [gx, gy, gz], type, rot }]);
  };

  const removeCube = (id: string) => {
    if (cubes.length <= 1) return;
    setCubes(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="w-full h-screen flex flex-col md:flex-row bg-[#0a0f1d] overflow-hidden">
      <UIOverlay 
        cubeCount={cubes.length} 
        floors={floors}
        totalBudget={totalBudget}
        onReset={resetProject} 
        surfaces={surfaces}
        activeModuleType={activeModuleType}
        setActiveModuleType={setActiveModuleType}
        activeRot={activeRot}
        setActiveRot={setActiveRot}
      />
      <main className="order-1 md:order-2 flex-1 relative min-h-[45vh] md:min-h-full h-full border-b md:border-b-0 md:border-l border-slate-700/50 bg-slate-900 shadow-2xl">
        <Canvas 
          shadows 
          gl={{ preserveDrawingBuffer: true }}
          camera={{ position: [10, 8, 10], fov: 45 }}
          className="w-full h-full z-0"
        >
          <color attach="background" args={['#0f172a']} />
          <fog attach="fog" args={['#0f172a', 20, 50]} />
          <ambientLight intensity={0.5} />
          <directionalLight castShadow position={[10, 15, 10]} intensity={1.8} shadow-mapSize={[2048, 2048]}>
            <orthographicCamera attach="shadow-camera" args={[-15, 15, 15, -15, 0.1, 50]} />
          </directionalLight>
          <Scene 
            cubes={cubes} 
            onAddCube={addCube} 
            onRemoveCube={removeCube} 
            activeModuleType={activeModuleType}
            activeRot={activeRot}
            isOccupied={isOccupied}
          />
          <Environment preset="city" />
          <ContactShadows position={[0, -0.01, 0]} opacity={0.6} scale={25} blur={2} far={4} color="#000000" />
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} minDistance={5} maxDistance={40} />
        </Canvas>
      </main>
    </div>
  );
}

export default App;
