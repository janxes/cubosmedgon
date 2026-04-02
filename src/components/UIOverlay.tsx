import { RotateCcw, Download, Square, ArrowUpSquare, ArrowDownSquare, Grid3X3, AlignCenterVertical, Settings2, HandCoins, Box, Sidebar, Maximize, Eraser, MousePointerClick, AlignLeft, AlignCenter, AlignRight, Save, FolderOpen, ClipboardCopy, Printer, Undo2, Redo2, GraduationCap, DoorClosed } from 'lucide-react';
import type { Rotation3D, ToolType, WindowAlign, WindowType, CubeModule } from '../App';
import { MODULE_PRICES, WINDOW_PRICES, ROOF_PRICE_PER_MODULE } from '../App';
import { generateBlueprints } from '../utils/blueprintExporter';

export const TOOLS = [
  { id: 'SELECT', name: 'Mover', icon: MousePointerClick, desc: 'Toca un módulo para seleccionarlo y moverlo o girarlo en sitio.' },
  { id: 'ERASE', name: 'Borrar', icon: Eraser, desc: 'Elimina pieza o ventana al hacer click' },
  { id: 'A', name: 'Módulo A', icon: Box, desc: 'Estructural 3x3x3m' },
  { id: 'B', name: 'Estrecho B', icon: Sidebar, desc: 'Estructural 1.5x3x3m' },
  { id: 'WINDOW', name: 'Ventanas', icon: Maximize, desc: 'Herramienta de Ventanas' },
  { id: 'DOOR', name: 'Puerta', icon: DoorClosed, desc: 'Puerta exterior de 1.20m' },
  { id: 'ROOF', name: 'Tejado', icon: GraduationCap, desc: 'Añadir o quitar tejado a un módulo' },
];

interface UIOverlayProps {
  cubes: CubeModule[];
  cubeCount: number;
  floors: number;
  totalBudget: number;
  onReset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onLoad: () => void;
  surfaces: {
    roofArea: number;
    floorArea: number;
    slabArea: number;
    wallArea: number;
    totalArea: number;
    utilArea: number;
  };
  activeTool: ToolType;
  setActiveTool: (t: ToolType) => void;
  activeRot: Rotation3D;
  setActiveRot: (t: Rotation3D) => void;
  activeWindowType: WindowType;
  setActiveWindowType: (t: WindowType) => void;
  activeWindowAlign: WindowAlign;
  setActiveWindowAlign: (w: WindowAlign) => void;
  onRotateSelected: () => void;
  hasSelection: boolean;
  snapGrid: 3.0 | 1.5;
  setSnapGrid: React.Dispatch<React.SetStateAction<3.0 | 1.5>>;
}

export default function UIOverlay({ cubes, cubeCount, floors, totalBudget, onReset, undo, redo, canUndo, canRedo, onSave, onLoad, surfaces, activeTool, setActiveTool, activeRot, setActiveRot, activeWindowType, setActiveWindowType, activeWindowAlign, setActiveWindowAlign, onRotateSelected, hasSelection, snapGrid, setSnapGrid }: UIOverlayProps) {
  const formattedBudget = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalBudget);

  const handleExport = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'composicion-medgon.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyExcel = () => {
    let countA = 0, countB = 0, w300 = 0, w150 = 0, w100 = 0, doors = 0, roofs = 0;

    cubes.forEach(c => {
      if (c.id === 'initial' && Object.keys(c.windows || {}).length === 0 && cubes.length === 1) return;
      if (c.type === 'A') countA++;
      if (c.type === 'B') countB++;
      if (c.hasRoof) roofs++;
      if (c.windows) {
        Object.values(c.windows).forEach(w => {
          if (w.type === 'w300') w300++;
          if (w.type === 'w150') w150++;
          if (w.type === 'w100') w100++;
          if (w.type === 'door') doors++;
        });
      }
    });

    const lines = [
      ['INFORME DE PROYECTO', 'MEDGÓN PASSIVHAUS'],
      [],
      ['ELEMENTO', 'CANT.', 'P. UNITARIO', 'COSTE TOTAL'],
    ];

    if (countA > 0) lines.push(['Módulo Estructural A (3x3x3)', countA.toString(), `${MODULE_PRICES['A']} €`, `${countA * MODULE_PRICES['A']} €`]);
    if (countB > 0) lines.push(['Módulo Estrecho B (1.5x3x3)', countB.toString(), `${MODULE_PRICES['B']} €`, `${countB * MODULE_PRICES['B']} €`]);
    if (roofs > 0) lines.push(['Tejado Inclinado a 2 Aguas (por módulo)', roofs.toString(), `${ROOF_PRICE_PER_MODULE} €`, `${roofs * ROOF_PRICE_PER_MODULE} €`]);
    if (w300 > 0) lines.push(['Ventana Grande 3.0x2.10m', w300.toString(), `${WINDOW_PRICES['w300']} €`, `${w300 * WINDOW_PRICES['w300']} €`]);
    if (w150 > 0) lines.push(['Ventana Mediana 1.5x2.10m', w150.toString(), `${WINDOW_PRICES['w150']} €`, `${w150 * WINDOW_PRICES['w150']} €`]);
    if (w100 > 0) lines.push(['Ventana Pequeña 1.0x2.10m', w100.toString(), `${WINDOW_PRICES['w100']} €`, `${w100 * WINDOW_PRICES['w100']} €`]);
    if (doors > 0) lines.push(['Puerta Exterior 1.20m', doors.toString(), `${WINDOW_PRICES['door']} €`, `${doors * WINDOW_PRICES['door']} €`]);
    
    lines.push([]);
    lines.push(['SUPERFICIES ESTIMADAS']);
    lines.push(['Cubierta', `${surfaces.roofArea} m2`]);
    lines.push(['Cimentación', `${surfaces.floorArea} m2`]);
    lines.push(['Forjados', `${surfaces.slabArea} m2`]);
    lines.push(['Muros Exteriores', `${surfaces.wallArea} m2`]);
    lines.push(['Suma Total Envolvente', `${surfaces.totalArea} m2`]);
    lines.push(['SUPERFICIE ÚTIL (Suelo+Forjados)', `${surfaces.utilArea} m2`]);
    
    lines.push([]);
    lines.push(['PRESUPUESTO TOTAL', '', '', `${totalBudget} €`]);

    const tsvData = lines.map(row => row.join('\t')).join('\n');

    navigator.clipboard.writeText(tsvData).then(() => {
      alert('¡Datos copiados al portapapeles! Ahora puedes ir a Excel o Google Sheets y darle a Pegar (Ctrl+V).');
    }).catch(err => {
      console.error(err);
      alert('No se pudo copiar al portapapeles. Asegúrate de dar permisos a tu navegador web.');
    });
  };

  const handleRotate = () => {
    if (activeTool === 'SELECT' && hasSelection) {
      onRotateSelected();
    } else {
      setActiveRot([activeRot[0], (activeRot[1] + 90) % 360, activeRot[2]]);
    }
  };



  return (
    <aside className="order-2 md:order-1 w-full md:w-[35vw] lg:w-[30vw] flex-shrink-0 h-1/2 md:h-full bg-[#0a0f1d] flex flex-col justify-between p-6 md:p-8 z-10 overflow-y-auto shadow-2xl space-y-8">
      
      <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="bg-white p-2 rounded-lg flex items-center justify-center shrink-0">
          <img src="/logo.png" alt="Medgón Passivhaus" className="w-[100px] object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
        <div className="flex flex-col">
          <h1 className="text-2xl lg:text-3xl font-semibold text-white m-0 leading-none tracking-tighter">
            Configurador <span className="text-gradient">Modular</span>
          </h1>
          <p className="text-amber-400/80 text-[11px] mt-1.5 font-medium tracking-tight uppercase">Desarrollo Creativo 3D</p>
        </div>
      </div>

      <div className="glass-panel p-5 border-l-4 border-l-amber-500">
        <p className="text-amber-400 text-sm uppercase tracking-widest font-bold flex items-center gap-2 mb-4">
          <Settings2 size={18} /> Herramientas
        </p>

        <div className="grid grid-cols-4 gap-2 mb-4">
           <button onClick={undo} disabled={!canUndo} className={`btn py-2 flex flex-col items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 justify-center font-bold tracking-wider rounded-lg border border-white/10 ${!canUndo ? 'opacity-30 cursor-not-allowed' : ''}`} title="Deshacer"><Undo2 size={18} /> DESHACER</button>
           <button onClick={redo} disabled={!canRedo} className={`btn py-2 flex flex-col items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 justify-center font-bold tracking-wider rounded-lg border border-white/10 ${!canRedo ? 'opacity-30 cursor-not-allowed' : ''}`} title="Rehacer"><Redo2 size={18} /> REHACER</button>
           <button onClick={handleRotate} className="btn py-2 flex flex-col items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 justify-center font-bold tracking-wider rounded-lg border border-white/10" title={activeTool === 'SELECT' ? "Rotar Módulo Seleccionado" : "Rotar Nueva Pieza"}>
              <RotateCcw size={18} /> GIRAR
           </button>
           <button onClick={() => setSnapGrid(s => s === 3.0 ? 1.5 : 3.0)} className={`btn py-2 flex flex-col items-center gap-1 text-[10px] justify-center font-bold tracking-wider rounded-lg border border-white/10 transition-colors ${snapGrid === 1.5 ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Alternar encaje a rejilla de 3m o 1.5m">
              <Grid3X3 size={18} /> {snapGrid === 3.0 ? 'GRID 3x3' : 'GRID 1.5'}
           </button>
        </div>
        
        {activeTool === 'WINDOW' && (
          <>
            <p className="text-gray-400 text-[10px] mb-1 font-bold uppercase tracking-widest text-center">Tamaño de Ventana</p>
            <div className="flex bg-[#0f172a] rounded-lg p-1 mb-2 border border-white/10">
              <button onClick={() => setActiveWindowType('w300')} className={`flex-1 py-1.5 flex justify-center rounded-md font-bold text-xs ${activeWindowType === 'w300' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}>3.0m</button>
              <button onClick={() => setActiveWindowType('w150')} className={`flex-1 py-1.5 flex justify-center rounded-md font-bold text-xs ${activeWindowType === 'w150' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}>1.5m</button>
              <button onClick={() => setActiveWindowType('w100')} className={`flex-1 py-1.5 flex justify-center rounded-md font-bold text-xs ${activeWindowType === 'w100' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}>1.0m</button>
            </div>
          </>
        )}
        
        {(activeTool === 'WINDOW' || activeTool === 'DOOR') && (
          <>
            <p className="text-gray-400 text-[10px] mb-1 font-bold uppercase tracking-widest text-center">Alineación</p>
            <div className="flex bg-[#0f172a] rounded-lg p-1 mb-4 border border-white/10">
              <button onClick={() => setActiveWindowAlign('left')} className={`flex-1 py-1.5 flex justify-center rounded-md ${activeWindowAlign === 'left' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}><AlignLeft size={16} /></button>
              <button onClick={() => setActiveWindowAlign('center')} className={`flex-1 py-1.5 flex justify-center rounded-md ${activeWindowAlign === 'center' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}><AlignCenter size={16} /></button>
              <button onClick={() => setActiveWindowAlign('right')} className={`flex-1 py-1.5 flex justify-center rounded-md ${activeWindowAlign === 'right' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}><AlignRight size={16} /></button>
            </div>
          </>
        )}

        <div className="grid grid-cols-4 gap-2">
          {(TOOLS as any[]).map(t => {
            const Icon = t.icon;
            const isActive = activeTool === t.id;
            // Highlight eraser in red slightly
            const activeColor = t.id === 'ERASE' ? 'bg-red-500/20 border-red-400/50' : 'bg-amber-500/20 border-amber-400/50';

            return (
              <button 
                key={t.id}
                onClick={() => setActiveTool(t.id as ToolType)}
                className={`py-3 px-1 flex flex-col items-center justify-center gap-2 rounded-lg border transition-all ${isActive ? `${activeColor} text-white shadow-lg scale-105` : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                title={t.desc}
              >
                <Icon size={22} />
                <span className="text-[9px] uppercase tracking-widest text-center leading-none font-bold">{t.name}</span>
              </button>
            )
          })}
        </div>
        <p className="text-gray-400 text-[10px] text-center mt-4 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
          <span className="text-amber-400">Estado:</span> 
          {activeTool === 'SELECT' ? (hasSelection ? 'Módulo Seleccionado' : 'Busca un módulo') : `Rotación a ${activeRot[1]}°`}
        </p>
      </div>

      <div className="glass-panel p-5 border-l-4 border-l-sky-500 flex flex-col gap-4">
        <p className="text-sky-400 text-sm uppercase tracking-widest font-bold flex items-center gap-2">
          <ClipboardCopy size={18} /> Datos del Proyecto
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5">
            <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-1">Módulos</div>
            <div className="text-xl font-bold text-white leading-none">{cubeCount}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5">
            <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-1">Plantas</div>
            <div className="text-xl font-bold text-white leading-none">{floors}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center border border-emerald-500/20 col-span-2 relative overflow-hidden">
            <HandCoins size={24} className="absolute right-2 top-2 text-emerald-500/10 pointer-events-none" />
            <div className="text-emerald-400/80 text-[10px] uppercase font-bold tracking-wider mb-1">Presupuesto</div>
            <div className="text-xl font-bold text-emerald-400 leading-none">{formattedBudget}</div>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-4 border border-white/5">
          <div className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-3 border-b border-white/10 pb-2 flex justify-between">
            <span>Superficies Estimadas</span>
            <span className="text-emerald-400">Útil: {surfaces.utilArea} m²</span>
          </div>
          <div className="grid grid-cols-3 gap-y-3 gap-x-2">
            <div>
              <div className="flex items-center gap-1 text-gray-300 text-[9px] uppercase"><ArrowUpSquare size={12}/> Cubierta</div>
              <div className="text-sm font-bold text-white mt-0.5">{surfaces.roofArea} m²</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-gray-300 text-[9px] uppercase"><ArrowDownSquare size={12}/> Cimentación</div>
              <div className="text-sm font-bold text-white mt-0.5">{surfaces.floorArea} m²</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-gray-300 text-[9px] uppercase"><AlignCenterVertical size={12}/> Forjados</div>
              <div className="text-sm font-bold text-white mt-0.5">{surfaces.slabArea} m²</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-gray-300 text-[9px] uppercase"><Square size={12}/> Muros Ext.</div>
              <div className="text-sm font-bold text-white mt-0.5">{surfaces.wallArea} m²</div>
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-1 text-sky-400/80 text-[9px] uppercase"><Grid3X3 size={12}/> Total Envolvente</div>
              <div className="text-sm font-bold text-sky-300 mt-0.5">{surfaces.totalArea} m²</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 relative">
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-2 w-full">
          <button onClick={onSave} className="btn bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 py-3 flex flex-col items-center justify-center gap-1 text-[10px] font-bold" title="Guardar Proyecto Local">
            <Save size={18} />
            Guardar
          </button>
          <button onClick={onLoad} className="btn bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 py-3 flex flex-col items-center justify-center gap-1 text-[10px] font-bold" title="Cargar Proyecto Local">
            <FolderOpen size={18} />
            Cargar
          </button>
          <button onClick={() => {
            const canvas = document.querySelector('canvas');
            const dataUrl = canvas ? canvas.toDataURL('image/jpeg', 1.0) : undefined;
            generateBlueprints(cubes, dataUrl, surfaces, totalBudget);
          }} className="btn bg-sky-500/20 hover:bg-sky-500/40 text-sky-400 py-3 flex flex-col items-center justify-center gap-1 text-[10px] font-bold" title="Planos Técnicos en PDF">
            <Printer size={18} />
            Planos PDF
          </button>
          <button onClick={handleExport} className="btn bg-white/10 hover:bg-white/20 py-3 flex flex-col items-center justify-center gap-1 text-[10px] font-bold" title="Exportar Rápido PNG">
            <Download size={18} />
            Foto PNG
          </button>
          <button onClick={handleCopyExcel} className="btn bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 py-3 flex flex-col items-center justify-center gap-1 text-[10px] font-bold" title="Copiar Desglose para Hoja de Cálculo">
            <ClipboardCopy size={18} />
            Copiar Excel
          </button>
        </div>
        <button onClick={onReset} className="btn bg-red-500/20 hover:bg-red-500/40 text-red-500 w-full py-3 justify-center text-sm font-bold border border-red-500/20" title="Reiniciar Diseño por completo">
          <RotateCcw size={18} />
          Borrar Todo el Diseño
        </button>
      </div>
    </aside>
  );
}
