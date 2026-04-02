import type { CubeModule } from '../App';
import { getGridBounds } from '../App';
import polygonClipping from 'polygon-clipping';
import straightSkeletonPkg from 'straight-skeleton';
const { SkeletonBuilder } = straightSkeletonPkg;

export let isSkeletonReady = false;
SkeletonBuilder.init().then(() => {
    isSkeletonReady = true;
}).catch(e => console.error("SkeletonBuilder error:", e));

export type Roof3DPolygon = { x: number, y: number, z: number }[];

export type UnifiedRoof = {
    yBase: number;
    polygons3D: Roof3DPolygon[];
};

// No pointToLineDistance needed, time property of vertex contains orthogonal distance.

// Area calculation removed as polygon-clipping handles correct CCW/CW orientations.

export function generateUnifiedRoofs(cubes: CubeModule[]): UnifiedRoof[] {
    if (!isSkeletonReady) return [];
    const roofCubes = cubes.filter(c => c.hasRoof);
    if (roofCubes.length === 0) return [];

    // Map all covered cells with highest Y
    const maxHTable = new Map<string, number>();

    roofCubes.forEach(c => {
        const [w, h, d] = getGridBounds(c.type, c.rot);
        for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
                const nx = c.pos[0] + dx;
                const nz = c.pos[2] + dz;
                const ny = c.pos[1] + h; 
                const key = `${Math.round(nx)},${Math.round(nz)}`;
                const currentMax = maxHTable.get(key) || 0;
                if (ny > currentMax) {
                    maxHTable.set(key, ny);
                }
            }
        }
    });

    // Group cells by Y level
    const yGroups = new Map<number, { x: number, z: number }[]>();
    maxHTable.forEach((y, key) => {
        const [x, z] = key.split(',').map(Number);
        if (!yGroups.has(y)) yGroups.set(y, []);
        yGroups.get(y)!.push({ x, z });
    });

    const unifiedRoofs: UnifiedRoof[] = [];

    // For each Y level, union the cells into polygons
    yGroups.forEach((cells, y) => {
        // Configuracion de alero (overhang): 0.5 metros
        const overhangMeters = 0.5; 
        const overhang = overhangMeters / 1.5; // Convertir a unidades de grid (cada grid unit es 1.5m)

        // Create 1x1 polygon for each cell, expanded by the overhang
        const rects: polygonClipping.Geom[] = cells.map(c => [[
            [c.x - overhang, c.z - overhang],
            [c.x + 1 + overhang, c.z - overhang],
            [c.x + 1 + overhang, c.z + 1 + overhang],
            [c.x - overhang, c.z + 1 + overhang],
            [c.x - overhang, c.z - overhang] // close the ring
        ]]);

        // Union all cell polygons
        const unionResult = polygonClipping.union(rects[0], ...rects.slice(1));
        
        unionResult.forEach(poly => {
            try {
                // Formatting for straight-skeleton
                const formattedPoly = poly.map(ring => ring.map(p => [p[0], p[1]]));
                
                const skeleton = SkeletonBuilder.buildFromPolygon(formattedPoly);
                if (!skeleton) return;
                
                const pitch = 30 * (Math.PI / 180);
                
                const verts = skeleton.vertices;
                const polys3D: Roof3DPolygon[] = skeleton.polygons.map((skelPolyIndices: number[]) => {
                    return skelPolyIndices.map(idx => {
                        const v = verts[idx];
                        // v[2] is the inward distance from the expanded outer edge.
                        // We subtract the overhang so the roof height is exactly 0 at the wall line,
                        // making the eaves (aleros) hang lower (negative height) naturally.
                        const height = (v[2] - overhang) * Math.tan(pitch);
                        return { x: v[0], y: height, z: v[1] };
                    });
                });
                
                unifiedRoofs.push({
                    yBase: y,
                    polygons3D: polys3D
                });
            } catch (e) {
                console.error("Error building skeleton for roof", e);
            }
        });
    });

    return unifiedRoofs;
}
