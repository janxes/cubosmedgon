import * as THREE from 'three';
import { jsPDF } from 'jspdf';
import type { CubeModule } from '../App';
import { getGridBounds, MODULE_PRICES, WINDOW_PRICES, ROOF_PRICE_PER_MODULE } from '../App';
import { generateUnifiedRoofs } from './roofAlgorithm';
import type { UnifiedRoof } from './roofAlgorithm';

export async function generateBlueprints(cubes: CubeModule[], userViewDataUrl: string | undefined, surfaces: any, totalBudget: number) {
  const width = 1200;
  const height = 1200;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.setClearColor(0xffffff, 1);

  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  let countA = 0, countB = 0, w300 = 0, w150 = 0, w100 = 0, roofs = 0;

  cubes.forEach(cube => {
    if (cube.id === 'initial' && Object.keys(cube.windows).length === 0 && cubes.length === 1) return;
    
    if (cube.type === 'A') countA++;
    if (cube.type === 'B') countB++;
    if (cube.hasRoof) roofs++;
    if (cube.windows) {
      Object.values(cube.windows).forEach(w => {
        if (w.type === 'w300') w300++;
        if (w.type === 'w150') w150++;
        if (w.type === 'w100') w100++;
      });
    }

    const [cw, ch, cd] = getGridBounds(cube.type, cube.rot);
    const worldX = (cube.pos[0] + cw / 2) * 0.5;
    const worldY = (cube.pos[1] + ch / 2) * 0.5;
    const worldZ = (cube.pos[2] + cd / 2) * 0.5;
    
    const group = new THREE.Group();
    group.position.set(worldX, worldY, worldZ);
    group.rotation.set(
      cube.rot[0] * Math.PI / 180,
      cube.rot[1] * Math.PI / 180,
      cube.rot[2] * Math.PI / 180
    );

    const args: [number, number, number] = cube.type === 'B' ? [0.5, 1, 1] : [1, 1, 1];
    const geo = new THREE.BoxGeometry(...args);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 1.0, flatShading: true }); 
    const box = new THREE.Mesh(geo, mat);
    
    const edgesGeo = new THREE.EdgesGeometry(geo, 15);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    box.add(edges);
    group.add(box);

    if (cube.windows) {
      Object.entries(cube.windows).map(([normalStr, wData]) => {
          const [nx, ny, nz] = normalStr.split(',').map(Number);
          let rotX = 0, rotY = 0, rotZ = 0;
          if (nx === 1) rotY = Math.PI / 2;
          if (nx === -1) rotY = -Math.PI / 2;
          if (ny === 1) rotX = -Math.PI / 2;
          if (ny === -1) rotX = Math.PI / 2;
          if (nz === 1) rotY = 0;
          if (nz === -1) rotY = Math.PI;

          const wMultiplier = wData.type === 'door' ? 0.4 : (wData.type === 'w300' ? 0.95 : (wData.type === 'w150' ? 0.50 : 0.33));
          let planeW = wMultiplier;
          let planeH = args[1] * 0.70; // All windows and doors are 2.10m high (0.7)
          let localFaceWidth = 1;

          if (nx !== 0) { planeW *= args[2]; localFaceWidth = args[2]; } 
          else if (nz !== 0) { planeW *= args[0]; localFaceWidth = args[0]; } 
          else if (ny !== 0) { planeW *= args[0]; planeH = args[2] * 0.75; localFaceWidth = args[0]; } 

          let px = nx * (args[0] / 2 + 0.001);
          let py = ny * (args[1] / 2 + 0.001);
          let pz = nz * (args[2] / 2 + 0.001);

          if (ny === 0) {
             py = -args[1] / 2 + planeH / 2 + 0.005;
          }

          if (wData.align === 'left' || wData.align === 'right') {
             const gap = localFaceWidth - planeW;
             let shift = gap / 2;
             if (wData.align === 'left') shift = -shift;

             if (nx === 1) { pz += shift; }
             if (nx === -1) { pz -= shift; }
             if (nz === 1) { px += shift; }
             if (nz === -1) { px -= shift; }
          }

          const winGeo = new THREE.PlaneGeometry(planeW, planeH);
          const winMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
          const winPlane = new THREE.Mesh(winGeo, winMat);
          winPlane.position.set(px, py, pz);
          winPlane.rotation.set(rotX, rotY, rotZ);
          
          const winEdgesGeo = new THREE.EdgesGeometry(winGeo);
          const winEdgesMat = new THREE.LineBasicMaterial({ color: 0x0284c7 });
          const winEdges = new THREE.LineSegments(winEdgesGeo, winEdgesMat);
          winPlane.add(winEdges);
          group.add(winPlane);
      });
    }
    scene.add(group);
  });

  // Render Roofs
  const unifiedRoofs = generateUnifiedRoofs(cubes);
  unifiedRoofs.forEach((roof: UnifiedRoof) => {
    const cellSize = 0.5;
    
    const positions: number[] = [];
    const indices: number[] = [];
    
    let vertexOffset = 0;

    roof.polygons3D.forEach(poly => {
       poly.forEach(pt => {
           positions.push(pt.x * cellSize, pt.y * cellSize, pt.z * cellSize);
       });
       
       const n = poly.length;
       for (let i = 1; i < n - 1; i++) {
           indices.push(vertexOffset, vertexOffset + i, vertexOffset + i + 1);
       }
       vertexOffset += n;
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    const roofMesh = new THREE.Mesh(geom, mat);

    const edgesGeo = new THREE.EdgesGeometry(geom, 30);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 2 });
    const edges = new THREE.LineSegments(edgesGeo, edgesMat);
    roofMesh.add(edges);

    roofMesh.position.set(0, roof.yBase * cellSize, 0);
    
    scene.add(roofMesh);
  });

  const box3 = new THREE.Box3().setFromObject(scene);
  if (box3.isEmpty()) {
    box3.set(new THREE.Vector3(-2,-2,-2), new THREE.Vector3(2,2,2));
  }
  
  const size = box3.getSize(new THREE.Vector3());
  const center = box3.getCenter(new THREE.Vector3());
  
  const maxDim = Math.max(size.x, size.y, size.z, 2);
  const d = maxDim * 1.25; // Increased from 0.85 to add generous margins
  const cameraZ = Math.max(maxDim * 3, 15);

  const renderView = (posX: number, posY: number, posZ: number, lookAt: THREE.Vector3, isTop: boolean = false) => {
    const camera = new THREE.OrthographicCamera(-d, d, d, -d, -100, 1000);
    camera.position.set(center.x + posX, center.y + posY, center.z + posZ);
    camera.lookAt(lookAt);
    if (isTop) {
      camera.up.set(0, 0, -1);
      camera.lookAt(lookAt);
    }
    renderer.render(scene, camera);
    return canvas.toDataURL('image/jpeg', 1.0);
  };

  const views = {
    top: renderView(0, cameraZ, 0, center, true),
    front: renderView(0, 0, cameraZ, center),
    back: renderView(0, 0, -cameraZ, center),
    left: renderView(-cameraZ, 0, 0, center),
    right: renderView(cameraZ, 0, 0, center)
  };

  const pdf = new jsPDF('landscape', 'mm', 'a4');
  
  // -- PAGE 1: RESUMEN Y PRESUPUESTO (MODERN LAYOUT) --
  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, 297, 45, 'F');
  
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(28);
  pdf.text('MEMORIA DEL PROYECTO', 20, 24);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Configurador Modular 3D - Medgón Passivhaus', 20, 34);

  // Column 1: Presupuesto
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DESGLOSE ECONÓMICO', 20, 65);

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.5);
  pdf.line(20, 70, 140, 70);

  let y = 80;
  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184); // slate-400
  pdf.text('ELEMENTO', 20, y);
  pdf.text('PRECIO UD.', 120, y, { align: 'right' });
  pdf.text('TOTAL', 140, y, { align: 'right' });
  y += 8;

  const drawRow = (label: string, qty: number, price: number) => {
    if (qty === 0) return;
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${label} (x${qty})`, 20, y);
    pdf.text(`${price.toLocaleString('es-ES')} €`, 120, y, { align: 'right' });
    pdf.text(`${(qty * price).toLocaleString('es-ES')} €`, 140, y, { align: 'right' });
    y += 10;
  };
  
  drawRow('Módulo Estructural A (3x3x3)', countA, MODULE_PRICES['A']);
  drawRow('Módulo Estrecho B (1.5x3x3)', countB, MODULE_PRICES['B']);
  drawRow('Tejado Inclinado a 2 Aguas', roofs, ROOF_PRICE_PER_MODULE);
  drawRow('Ventana Grande 3.0x2.10m', w300, WINDOW_PRICES['w300']);
  drawRow('Ventana Mediana 1.5x2.10m', w150, WINDOW_PRICES['w150']);
  drawRow('Ventana Pequeña 1.0x2.10m', w100, WINDOW_PRICES['w100']);

  y += 5;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(20, y, 140, y);
  y += 12;
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('PRESUPUESTO ESTIMADO', 20, y);
  pdf.setTextColor(16, 185, 129); // emerald-500
  pdf.setFontSize(18);
  pdf.text(`${totalBudget.toLocaleString('es-ES')} €`, 140, y, { align: 'right' });

  // Column 2: Superficies
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CUADRO DE SUPERFICIES', 160, 65);
  pdf.setDrawColor(226, 232, 240);
  pdf.line(160, 70, 277, 70);

  let sy = 82;
  const drawSurface = (label: string, area: number, bold: boolean = false) => {
    pdf.setTextColor(51, 65, 85);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(11);
    pdf.text(label, 160, sy);
    pdf.text(`${area.toLocaleString('es-ES')} m2`, 277, sy, { align: 'right' });
    sy += 10;
  };
  
  drawSurface('Cubierta Máxima', surfaces.roofArea);
  drawSurface('Cimentación Base', surfaces.floorArea);
  drawSurface('Forjados Interiores', surfaces.slabArea);
  drawSurface('Muros Exteriores Totales', surfaces.wallArea);
  
  sy += 5;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(160, sy, 277, sy);
  sy += 12;
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SUPERFICIE ÚTIL (Suelo + Forjado)', 160, sy);
  pdf.setTextColor(14, 165, 233); // sky-500
  pdf.setFontSize(18);
  pdf.text(`${surfaces.utilArea.toLocaleString('es-ES')} m2`, 277, sy, { align: 'right' });

  // -- PAGE 2: Planta --
  pdf.addPage();
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('PERÍMETRO Y PLANTA', 20, 25);
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Vista satélite de distribución ortográfica', 20, 33);
  pdf.addImage(views.top, 'JPEG', 75, 45, 140, 140);

  // -- PAGE 3: Alzados --
  pdf.addPage();
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('ALZADOS (FACHADAS EXTERIORES)', 20, 25);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(51, 65, 85);
  
  pdf.text('ALZADO FRONTAL (Sur)', 40, 45);
  pdf.addImage(views.front, 'JPEG', 30, 50, 100, 100);

  pdf.text('ALZADO POSTERIOR (Norte)', 160, 45);
  pdf.addImage(views.back, 'JPEG', 150, 50, 100, 100);

  pdf.text('ALZADO LATERAL IZQ (Oeste)', 40, 150);
  pdf.addImage(views.left, 'JPEG', 30, 155, 100, 100);

  pdf.text('ALZADO LATERAL DER (Este)', 160, 150);
  pdf.addImage(views.right, 'JPEG', 150, 155, 100, 100);

  // -- PAGE 4: Perspectiva --
  if (userViewDataUrl) {
    pdf.addPage();
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('PERSPECTIVA 3D DEL CLIENTE', 20, 25);
    pdf.addImage(userViewDataUrl, 'JPEG', 20, 35, 257, 145);
  }

  pdf.save('Documentacion_Tecnica_Medgon.pdf');
  renderer.dispose();
}
