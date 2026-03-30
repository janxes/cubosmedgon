import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';

export type Rotation3D = [number, number, number]; // Euler degrees 0, 90, 180, 270
export type WindowType = 'full' | 'half' | 'third';
export type WindowAlign = 'left' | 'center' | 'right';
export type WindowData = { type: WindowType, align: WindowAlign };
export type WindowsMap = Record<string, WindowData>;
export type ModuleType = 'A' | 'B';
export type ToolType = 'SELECT' | 'A' | 'B' | 'W_FULL' | 'W_HALF' | 'W_THIRD' | 'ERASE';

export type CubeModule = {
  id: string;
  pos: [number, number, number]; // [minX, minY, minZ] in 1.5m grid units
  type: ModuleType;
  rot: Rotation3D;
  windows: WindowsMap;
  color?: string;
};

export const MODULE_PRICES: Record<ModuleType, number> = {
  'A': 15000,
  'B': 7500,
};

export const WINDOW_PRICES: Record<WindowType, number> = {
  'full': 5000,
  'half': 3000,
  'third': 2000,
};

export const getGridBounds = (type: ModuleType, rot: Rotation3D): [number, number, number] => {
  if (type === 'A') return [2, 2, 2];
  let w = 1, h = 2, d = 2; // Default B bounds (1.5 width, 3 height, 3 depth)
  const [, ry, ] = rot;
  if (ry % 180 !== 0) { const t = w; w = d; d = t; }
  return [w, h, d];
};

function App() {
  const [activeTool, setActiveTool] = useState<ToolType>('A');
  const [activeRot, setActiveRot] = useState<Rotation3D>([0, 0, 0]);
  const [activeWindowAlign, setActiveWindowAlign] = useState<WindowAlign>('center');
  const [selectedCubeId, setSelectedCubeId] = useState<string | null>(null);

  const [history, setHistory] = useState<CubeModule[][]>([
    [{ id: 'initial', pos: [0, 0, 0], type: 'A', rot: [0, 0, 0], windows: {} }]
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const cubes = history[historyIndex];

  const setCubes = (action: React.SetStateAction<CubeModule[]>) => {
    const nextState = typeof action === 'function' ? action(cubes) : action;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(nextState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
    setSelectedCubeId(null);
  };

  const redo = () => {
    if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
    setSelectedCubeId(null);
  };

  useEffect(() => {
    if (activeTool !== 'SELECT' && activeTool !== 'ERASE') {
      setSelectedCubeId(null);
    }
  }, [activeTool]);

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

  const isOccupied = (x: number, y: number, z: number, ignoreId?: string) => {
    const id = cellMap.get(`${x},${y},${z}`);
    return id !== undefined && id !== ignoreId;
  };

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
      totalArea: (roofFaces + floorFaces + slabFaces + wallFaces) * 2.25,
      utilArea: (floorFaces + slabFaces) * 2.25
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
  
  const totalBudget = cubes.reduce((acc, c) => {
    const windowsCost = Object.values(c.windows).reduce((sum, w) => sum + WINDOW_PRICES[w.type], 0);
    return acc + MODULE_PRICES[c.type] + windowsCost;
  }, 0);

  const resetProject = () => {
    setCubes([{ id: 'initial', pos: [0, 0, 0], type: 'A', rot: [0, 0, 0], windows: {} }]);
    setSelectedCubeId(null);
  };

  const addCube = (gx: number, gy: number, gz: number, type: ModuleType, rot: Rotation3D) => {
    setCubes(prev => [...prev, { id: Date.now().toString(), pos: [gx, gy, gz], type, rot, windows: {} }]);
  };

  const moveCube = (id: string, gx: number, gy: number, gz: number) => {
    const c = cubes.find(x => x.id === id);
    if (!c) return;
    const [w, h, d] = getGridBounds(c.type, c.rot);
    let collision = false;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        for (let dz = 0; dz < d; dz++) {
          if (isOccupied(gx+dx, gy+dy, gz+dz, id)) collision = true;
        }
      }
    }
    if (!collision) {
      setCubes(prev => prev.map(x => x.id === id ? {...x, pos: [gx, gy, gz]} : x));
    }
  };

  const rotateSelectedCube = () => {
    if (!selectedCubeId) return;
    const c = cubes.find(x => x.id === selectedCubeId);
    if (!c) return;
    
    const newRot: Rotation3D = [c.rot[0], (c.rot[1] + 90) % 360, c.rot[2]];
    const [w, h, d] = getGridBounds(c.type, newRot);
    let collision = false;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        for (let dz = 0; dz < d; dz++) {
          if (isOccupied(c.pos[0]+dx, c.pos[1]+dy, c.pos[2]+dz, selectedCubeId)) collision = true;
        }
      }
    }
    
    if (!collision) {
      setCubes(prev => prev.map(x => x.id === c.id ? {...x, rot: newRot} : x));
    }
  };

  const removeCube = (id: string) => {
    setCubes(prev => prev.filter(c => c.id !== id));
    if (selectedCubeId === id) setSelectedCubeId(null);
  };

  const addWindow = (id: string, normalStr: string, wType: WindowType, align: WindowAlign) => {
    setCubes(prev => prev.map(c => c.id === id ? { ...c, windows: { ...c.windows, [normalStr]: {type: wType, align} } } : c));
  };

  const removeWindow = (id: string, normalStr: string) => {
    setCubes(prev => prev.map(c => {
      if (c.id === id) {
        const newWindows = { ...c.windows };
        delete newWindows[normalStr];
        return { ...c, windows: newWindows };
      }
      return c;
    }));
  };

  return (
    <div className="w-full h-screen flex flex-col md:flex-row bg-[#0a0f1d] overflow-hidden">
      <UIOverlay 
        cubes={cubes}
        cubeCount={cubes.length} 
        floors={floors}
        totalBudget={totalBudget}
        onReset={resetProject} 
        undo={undo}
        redo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onSave={() => {
          localStorage.setItem('medgon-project', JSON.stringify(cubes));
          alert('✅ Proyecto guardado con éxito en el navegador.');
        }}
        onLoad={() => {
          const data = localStorage.getItem('medgon-project');
          if (data) {
             setSelectedCubeId(null);
             setCubes(JSON.parse(data));
             alert('✅ Proyecto cargado correctamente.');
          } else {
             alert('⚠️ No se ha encontrado ningún proyecto guardado previamente en este navegador.');
          }
        }}
        surfaces={surfaces}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeRot={activeRot}
        setActiveRot={setActiveRot}
        activeWindowAlign={activeWindowAlign}
        setActiveWindowAlign={setActiveWindowAlign}
        onRotateSelected={rotateSelectedCube}
        hasSelection={!!selectedCubeId}
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
            activeTool={activeTool}
            activeRot={activeRot}
            activeWindowAlign={activeWindowAlign}
            selectedCubeId={selectedCubeId}
            isOccupied={isOccupied}
            onAddCube={addCube}
            onMoveCube={moveCube}
            onSelectCube={setSelectedCubeId}
            onRemoveCube={removeCube} 
            onAddWindow={addWindow}
            onRemoveWindow={removeWindow}
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
