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
        // Create 1x1 polygon for each cell
        const rects: polygonClipping.Geom[] = cells.map(c => [[
            [c.x, c.z],
            [c.x + 1, c.z],
            [c.x + 1, c.z + 1],
            [c.x, c.z + 1],
            [c.x, c.z] // close the ring
        ]]);

        // Union all cell polygons
        // polygonClipping.union can take multiple single polygons
        const unionResult = polygonClipping.union(rects[0], ...rects.slice(1));
        
        // unionResult is a MultiPolygon: Array<Polygon>
        // Polygon is Array<Ring>, Ring is Array<Position>
        unionResult.forEach(poly => {
            // poly[0] is exterior, poly[1..n] are holes
            try {
                // straight-skeleton expects GeoJSON-like polygons:
                // 1. Array of rings (number[][][])
                // 2. Closed rings (last point == first point)
                // 3. Outer CCW, inner CW.
                // polygonClipping natively produces EXACTLY this format!
                const formattedPoly = poly.map(ring => ring.map(p => [p[0], p[1]]));
                
                const skeleton = SkeletonBuilder.buildFromPolygon(formattedPoly);
                if (!skeleton) return;
                
                const pitch = 30 * (Math.PI / 180);
                
                // Skeleton returns vertices as [x, y, time] where time === distance to nearest edge
                // Polygons are arrays of vertex indices.
                const verts = skeleton.vertices;
                const polys3D: Roof3DPolygon[] = skeleton.polygons.map((skelPolyIndices: number[]) => {
                    return skelPolyIndices.map(idx => {
                        const v = verts[idx];
                        // v[0] = x, v[1] = z (2D space map), v[2] = time/distance
                        const height = v[2] * Math.tan(pitch);
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
