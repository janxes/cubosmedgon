import { Layers, RotateCcw, HelpCircle, Download, Square, ArrowUpSquare, ArrowDownSquare, Grid3X3, Building, AlignCenterVertical, Settings2, HandCoins } from 'lucide-react';
import type { Rotation3D } from '../App';

export type ModuleType = 'A' | 'B' | 'C' | 'D';

interface UIOverlayProps {
  cubeCount: number;
  floors: number;
  totalBudget: number;
  onReset: () => void;
  surfaces: {
    roofArea: number;
    floorArea: number;
    slabArea: number;
    wallArea: number;
    totalArea: number;
  };
  activeModuleType: ModuleType;
  setActiveModuleType: (t: ModuleType) => void;
  activeRot: Rotation3D;
  setActiveRot: (t: Rotation3D) => void;
}

export default function UIOverlay({ cubeCount, floors, totalBudget, onReset, surfaces, activeModuleType, setActiveModuleType, activeRot, setActiveRot }: UIOverlayProps) {
  const formattedBudget = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(totalBudget);

  const handleExport = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'composicion-medgon.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const cycleRotY = () => setActiveRot([activeRot[0], (activeRot[1] + 90) % 360, activeRot[2]]);

  return (
    <aside className="order-2 md:order-1 w-full md:w-[35vw] lg:w-[30vw] flex-shrink-0 h-1/2 md:h-full bg-[#0a0f1d] flex flex-col justify-between p-6 md:p-8 z-10 overflow-y-auto shadow-2xl space-y-8">
      
      <div className="flex flex-col gap-8">
        <div className="bg-white p-4 rounded-xl flex items-center justify-center shadow-lg w-full h-24">
          <img src="/logo.png" alt="Medgón Passivhaus" className="w-[150px] object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
        <div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white m-0 leading-tight tracking-wide">
            Viviendas <span className="text-gradient">Modulares</span>
          </h1>
          <p className="text-gray-400 text-base lg:text-lg m-0 mt-3 font-medium tracking-wide">Desarrollo Creativo 3D</p>
        </div>
      </div>

      <div className="glass-panel p-5 border-l-4 border-l-amber-500">
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-3 mb-3">
            <p className="text-amber-400 text-sm uppercase tracking-widest font-bold flex items-center gap-2 m-0 whitespace-nowrap">
              <Settings2 size={18} /> Módulo
            </p>
            <div className="flex gap-2">
               <button onClick={cycleRotY} className="btn py-1 px-3 text-xs bg-white/10 hover:bg-white/20 w-full justify-center font-bold tracking-wider" title="Rotar Horizontalmente">GIRAR ⟳</button>
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {([
            {t: 'A', g: 'Ciego (3x3x3)'}, 
            {t: 'B', g: 'Estrecho (1.5x3x3)'}, 
            {t: 'C', g: 'Vitrina 100%'}, 
            {t: 'D', g: 'Vitrina 50%'}
          ] as const).map(mod => (
            <button 
              key={mod.t}
              onClick={() => {
                setActiveModuleType(mod.t as ModuleType);
                setActiveRot([0, 0, 0]); // Reset rotation on change
              }}
              className={`py-3 px-2 flex flex-col items-center gap-1 rounded-lg border transition-all ${activeModuleType === mod.t ? 'bg-amber-500/20 border-amber-400/50 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
            >
              <strong className="text-xl lg:text-2xl">Tipo {mod.t}</strong>
              <span className="text-[10px] lg:text-xs uppercase tracking-widest text-center leading-none">{mod.g}</span>
            </button>
          ))}
        </div>
        <p className="text-gray-400 text-xs text-center mt-3 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
          <span className="text-amber-400">Orientación:</span> {activeRot[1]}°
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-5 border-l-4 border-l-indigo-500">
            <p className="text-indigo-400 text-sm uppercase tracking-widest font-bold mb-3">Módulos</p>
            <div className="flex items-center gap-3">
              <Layers size={28} className="text-white" />
              <div className="text-3xl lg:text-4xl font-bold text-white stat-value">{cubeCount}</div>
            </div>
          </div>
          <div className="glass-panel p-5 border-l-4 border-l-purple-500">
            <p className="text-purple-400 text-sm uppercase tracking-widest font-bold mb-3">Plantas</p>
            <div className="flex items-center gap-3">
              <Building size={28} className="text-white" />
              <div className="text-3xl lg:text-4xl font-bold text-white stat-value">{floors}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-sky-500 flex flex-col gap-4">
          <p className="text-sky-400 text-base uppercase tracking-widest font-bold mb-1">Superficies Estimadas</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1 uppercase"><ArrowUpSquare size={16}/> Techo</div>
              <div className="text-xl font-bold text-white">{surfaces.roofArea} m²</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1 uppercase"><ArrowDownSquare size={16}/> Suelo</div>
              <div className="text-xl font-bold text-white">{surfaces.floorArea} m²</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1 uppercase"><AlignCenterVertical size={16}/> Forjados</div>
              <div className="text-xl font-bold text-white">{surfaces.slabArea} m²</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1 uppercase"><Square size={16}/> Muros Ext.</div>
              <div className="text-xl font-bold text-white">{surfaces.wallArea} m²</div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <div className="text-right w-full">
                <div className="flex items-center gap-2 text-sky-400 text-sm mb-1 uppercase justify-end"><Grid3X3 size={16}/> Suma Áreas</div>
                <div className="text-3xl font-bold text-white stat-value">{surfaces.totalArea} m²</div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-emerald-500 relative overflow-hidden">
          <HandCoins size={120} className="absolute -right-6 -bottom-6 text-emerald-500/10 pointer-events-none" />
          <p className="text-emerald-400 text-sm uppercase tracking-widest font-bold mb-3">Presupuesto Estimado</p>
          <div className="text-4xl lg:text-5xl font-bold text-white stat-value text-gradient mb-1 relative z-10">{formattedBudget}</div>
          <p className="text-gray-400 text-xs mt-3 uppercase font-semibold relative z-10">
            A: 15k | B: 7.5k | C: 20k | D: 18.5k
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 relative">
        <div className="tooltip-container w-full">
          <div className="tooltip-trigger text-indigo-400 gap-2 mb-2">
            <HelpCircle size={24} />
            <span className="font-semibold uppercase tracking-wider text-sm">Ver Instrucciones</span>
          </div>
          <div className="tooltip-content glass-panel p-5 text-base text-gray-300 flex flex-col gap-3 shadow-2xl">
            <p><strong className="text-white">Rotación:</strong> Utiliza los botones X (Vertical), Y (Horizontal) y Z (Lateral) para girar el módulo antes de colocarlo.</p>
            <p><strong className="text-white">Click Izquierdo:</strong> Añade el tipo de módulo seleccionado apilándose perfectamente.</p>
            <p><strong className="text-white">Click Derecho:</strong> Elimina un módulo.</p>
            <p><strong className="text-white">Arrastrar:</strong> Rota y haz zoom en este lienzo 3D.</p>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 w-full">
          <button onClick={handleExport} className="btn bg-white/10 hover:bg-white/20 flex-1 py-3 justify-center text-sm font-semibold" title="Exportar Diseño PNG">
            <Download size={20} />
            Descargar
          </button>
          <button onClick={onReset} className="btn btn-primary flex-1 py-3 justify-center text-sm font-semibold" title="Reiniciar Diseño">
            <RotateCcw size={20} />
            Borrar Todo
          </button>
        </div>
      </div>
    </aside>
  );
}
