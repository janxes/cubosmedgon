import { Layers, RotateCcw, Download, Square, ArrowUpSquare, ArrowDownSquare, Grid3X3, Building, AlignCenterVertical, Settings2, HandCoins, Box, Sidebar, Maximize, Columns, PanelLeft, Eraser, MousePointerClick, AlignLeft, AlignCenter, AlignRight, Save, FolderOpen, ClipboardCopy, Printer } from 'lucide-react';
import type { Rotation3D, ToolType, WindowAlign, CubeModule } from '../App';
import { MODULE_PRICES, WINDOW_PRICES } from '../App';
import { generateBlueprints } from '../utils/blueprintExporter';

export const TOOLS = [
  { id: 'SELECT', name: 'Mover', icon: MousePointerClick, desc: 'Toca un módulo para seleccionarlo y moverlo o girarlo en sitio.' },
  { id: 'ERASE', name: 'Borrar', icon: Eraser, desc: 'Elimina pieza o ventana al hacer click' },
  { id: 'A', name: 'Módulo A', icon: Box, desc: 'Estructural 3x3x3m' },
  { id: 'B', name: 'Estrecho B', icon: Sidebar, desc: 'Estructural 1.5x3x3m' },
  { id: 'W_FULL', name: 'Ventana 100%', icon: Maximize, desc: 'Cristalera de ancho completo' },
  { id: 'W_HALF', name: 'Ventana 50%', icon: Columns, desc: 'Cristalera a media anchura' },
  { id: 'W_THIRD', name: 'Ventana 33%', icon: PanelLeft, desc: 'Cristalera a un tercio' },
];

interface UIOverlayProps {
  cubes: CubeModule[];
  cubeCount: number;
  floors: number;
  totalBudget: number;
  onReset: () => void;
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
  activeWindowAlign: WindowAlign;
  setActiveWindowAlign: (w: WindowAlign) => void;
  onRotateSelected: () => void;
  hasSelection: boolean;
}

export default function UIOverlay({ cubes, cubeCount, floors, totalBudget, onReset, onSave, onLoad, surfaces, activeTool, setActiveTool, activeRot, setActiveRot, activeWindowAlign, setActiveWindowAlign, onRotateSelected, hasSelection }: UIOverlayProps) {
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
    let countA = 0, countB = 0, wFull = 0, wHalf = 0, wThird = 0;

    cubes.forEach(c => {
      if (c.id === 'initial' && Object.keys(c.windows || {}).length === 0 && cubes.length === 1) return;
      if (c.type === 'A') countA++;
      if (c.type === 'B') countB++;
      if (c.windows) {
        Object.values(c.windows).forEach(w => {
          if (w.type === 'full') wFull++;
          if (w.type === 'half') wHalf++;
          if (w.type === 'third') wThird++;
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
    if (wFull > 0) lines.push(['Ventana Panorámica 100%', wFull.toString(), `${WINDOW_PRICES['full']} €`, `${wFull * WINDOW_PRICES['full']} €`]);
    if (wHalf > 0) lines.push(['Ventana Media 50%', wHalf.toString(), `${WINDOW_PRICES['half']} €`, `${wHalf * WINDOW_PRICES['half']} €`]);
    if (wThird > 0) lines.push(['Ventana Tercio 33%', wThird.toString(), `${WINDOW_PRICES['third']} €`, `${wThird * WINDOW_PRICES['third']} €`]);
    
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

  const isWindowTool = activeTool === 'W_HALF' || activeTool === 'W_THIRD';

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
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-3 mb-4">
            <p className="text-amber-400 text-sm uppercase tracking-widest font-bold flex items-center gap-2 m-0 whitespace-nowrap">
              <Settings2 size={18} /> Herramientas
            </p>
            <div className="flex gap-2">
               <button onClick={handleRotate} className="btn py-1 px-3 text-xs bg-white/10 hover:bg-white/20 w-full justify-center font-bold tracking-wider" title={activeTool === 'SELECT' ? "Rotar Módulo Seleccionado" : "Rotar Nueva Pieza"}>GIRAR MÓDULO ⟳</button>
            </div>
        </div>
        
        {isWindowTool && (
          <div className="flex bg-[#0f172a] rounded-lg p-1 mb-4 border border-white/10">
            <button onClick={() => setActiveWindowAlign('left')} className={`flex-1 py-1.5 flex justify-center rounded-md ${activeWindowAlign === 'left' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}><AlignLeft size={16} /></button>
            <button onClick={() => setActiveWindowAlign('center')} className={`flex-1 py-1.5 flex justify-center rounded-md ${activeWindowAlign === 'center' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}><AlignCenter size={16} /></button>
            <button onClick={() => setActiveWindowAlign('right')} className={`flex-1 py-1.5 flex justify-center rounded-md ${activeWindowAlign === 'right' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}><AlignRight size={16} /></button>
          </div>
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
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1 uppercase"><ArrowUpSquare size={16}/> Cubierta</div>
              <div className="text-xl font-bold text-white">{surfaces.roofArea} m²</div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1 uppercase"><ArrowDownSquare size={16}/> Cimentación</div>
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
          <div className="border-t border-white/10 pt-4 flex justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1 uppercase"><Square size={16}/> Superficie Útil</div>
              <div className="text-3xl lg:text-4xl font-bold text-white stat-value">{surfaces.utilArea} m²</div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-sky-400 text-sm mb-1 uppercase justify-end"><Grid3X3 size={16}/> Suma Áreas</div>
              <div className="text-2xl font-bold text-white stat-value mt-2">{surfaces.totalArea} m²</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-emerald-500 relative overflow-hidden">
          <HandCoins size={120} className="absolute -right-6 -bottom-6 text-emerald-500/10 pointer-events-none" />
          <p className="text-emerald-400 text-sm uppercase tracking-widest font-bold mb-3">Presupuesto Estimado</p>
          <div className="text-4xl lg:text-5xl font-bold text-white stat-value text-gradient mb-1 relative z-10">{formattedBudget}</div>
          <p className="text-gray-400 text-xs mt-3 uppercase font-semibold relative z-10 text-center xl:text-left">
            A: 15k | B: 7.5k | VENTANAS: 5k/3k/2k
          </p>
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
            generateBlueprints(cubes, dataUrl);
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
