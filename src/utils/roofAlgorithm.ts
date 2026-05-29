import type { CubeModule } from '../App';
import { getGridBounds } from '../App';
import * as THREE from 'three';

export type Roof3DPolygon = { x: number, y: number, z: number, roofType?: string }[];

export type UnifiedRoof = {
    yBase: number;
    polygons3D: Roof3DPolygon[];
    skirts3D?: Roof3DPolygon[];
};

const OVERHANG = 0.5 / 1.5; 

export function generateUnifiedRoofs(cubes: CubeModule[], pitchPercent: number = 12): UnifiedRoof[] {
    const roofCubes = cubes.filter(c => c.roofType && c.roofType !== 'none');
    if (roofCubes.length === 0) return [];

    const floorGroups = new Map<number, CubeModule[]>();
    roofCubes.forEach(c => {
        const h = getGridBounds(c.type, c.rot)[1];
        const yTop = c.pos[1] + h;
        if (!floorGroups.has(yTop)) floorGroups.set(yTop, []);
        floorGroups.get(yTop)!.push(c);
    });

    const unifiedRoofs: UnifiedRoof[] = [];
    // Dynamic pitch based on UI (pitchPercent is in %, so we divide by 100 for tangent)
    const activePitchRad = Math.atan(pitchPercent / 100);

    floorGroups.forEach((cells, yBase) => {
        const polys3D: Roof3DPolygon[] = [];
        const skirts3D: Roof3DPolygon[] = [];

        const clusters: CubeModule[][] = [];
        const visited = new Set<string>();
        
        cells.forEach(start => {
            if (visited.has(start.id)) return;
            const cluster: CubeModule[] = [];
            const queue = [start];
            while(queue.length > 0) {
                const c = queue.shift()!;
                if (visited.has(c.id)) continue;
                visited.add(c.id);
                cluster.push(c);
                cells.forEach(other => {
                    if (visited.has(other.id)) return;
                    const [w1, , d1] = getGridBounds(c.type, c.rot);
                    const [w2, , d2] = getGridBounds(other.type, other.rot);
                    const ox = Math.max(0, Math.min(c.pos[0]+w1, other.pos[0]+w2) - Math.max(c.pos[0], other.pos[0]));
                    const oz = Math.max(0, Math.min(c.pos[2]+d1, other.pos[2]+d2) - Math.max(c.pos[2], other.pos[2]));
                    if ((ox > 0 && oz >= 0) || (ox >= 0 && oz > 0)) {
                        if (Math.abs(c.pos[0]-other.pos[0]) <= 2.1 && Math.abs(c.pos[2]-other.pos[2]) <= 2.1) queue.push(other);
                    }
                });
            }
            clusters.push(cluster);
        });

        clusters.forEach(cluster => {
            const roofType = cluster[0].roofType || 'hip';
            
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            cluster.forEach(c => {
                const [w,,d] = getGridBounds(c.type, c.rot);
                if (c.pos[0] < minX) minX = c.pos[0];
                if (c.pos[0] + w > maxX) maxX = c.pos[0] + w;
                if (c.pos[2] < minZ) minZ = c.pos[2];
                if (c.pos[2] + d > maxZ) maxZ = c.pos[2] + d;
            });

            const exMinX = minX - OVERHANG, exMaxX = maxX + OVERHANG;
            const exMinZ = minZ - OVERHANG, exMaxZ = maxZ + OVERHANG;

            const heightAt = (x: number, z: number) => {
                // We use module bounds (inner) for height logic
                const bMinX = minX, bMaxX = maxX, bMinZ = minZ, bMaxZ = maxZ;
                
                if (roofType === 'hip') {
                    const distEdge = Math.min(x - exMinX, exMaxX - x, z - exMinZ, exMaxZ - z);
                    return Math.max(0, (distEdge - OVERHANG) * Math.tan(activePitchRad));
                }
                if (roofType === 'gable') {
                    const w = bMaxX - bMinX, d = bMaxZ - bMinZ;
                    if (w >= d) {
                        const midZ = (bMinZ + bMaxZ) / 2;
                        return (d/2 - Math.abs(z - midZ)) * Math.tan(activePitchRad);
                    } else {
                        const midX = (bMinX + bMaxX) / 2;
                        return (w/2 - Math.abs(x - midX)) * Math.tan(activePitchRad);
                    }
                }
                
                // SHED (Cascada) - Precise 4-way direction
                // We use endsWith to avoid spiral mismatch
                const tan = Math.tan(activePitchRad);
                if (roofType.endsWith('_n')) return (bMaxZ - z) * tan;
                if (roofType.endsWith('_s')) return (z - bMinZ) * tan;
                if (roofType.endsWith('_w')) return (bMaxX - x) * tan;
                if (roofType.endsWith('_e')) return (x - bMinX) * tan;
                return 0;
            };

            const step = 0.25; // Smaller step for better precision
            for (let x = exMinX; x < exMaxX; x += step) {
                for (let z = exMinZ; z < exMaxZ; z += step) {
                    const cx = x + step/2, cz = z + step/2;
                    let inFootprint = false;
                    cluster.forEach(c => {
                        const [w,,d] = getGridBounds(c.type, c.rot);
                        if (cx >= c.pos[0]-OVERHANG-0.01 && cx <= c.pos[0]+w+OVERHANG+0.01 && cz >= c.pos[2]-OVERHANG-0.01 && cz <= c.pos[2]+d+OVERHANG+0.01) {
                            inFootprint = true;
                        }
                    });

                    if (inFootprint) {
                        const x1 = x, x2 = x+step;
                        const z1 = z, z2 = z+step;
                        const p1 = { x: x1, y: heightAt(x1, z1), z: z1 };
                        const p2 = { x: x2, y: heightAt(x2, z1), z: z1 };
                        const p3 = { x: x2, y: heightAt(x2, z2), z: z2 };
                        const p4 = { x: x1, y: heightAt(x1, z2), z: z2 };
                        const poly: Roof3DPolygon = [p1, p2, p3, p4];
                        (poly as any).roofType = roofType;
                        polys3D.push(poly);
                    }
                }
            }

            // Skirts logic
            cluster.forEach(c => {
                const [w,,d] = getGridBounds(c.type, c.rot);
                const corners = [[c.pos[0],c.pos[2]], [c.pos[0]+w,c.pos[2]], [c.pos[0]+w,c.pos[2]+d], [c.pos[0],c.pos[2]+d], [c.pos[0],c.pos[2]]];
                for(let i=0; i<4; i++) {
                    const p1 = corners[i], p2 = corners[i+1];
                    let isExterior = true;
                    cluster.forEach(other => {
                       if (other === c) return;
                       const [ow,,od] = getGridBounds(other.type, other.rot);
                       const mx = (p1[0]+p2[0])/2, mz = (p1[1]+p2[1])/2;
                       if (mx >= other.pos[0] && mx <= other.pos[0]+ow && mz >= other.pos[2] && mz <= other.pos[2]+od) {
                          if ((p1[0]===p2[0] && (mx===other.pos[0]||mx===other.pos[0]+ow)) || (p1[1]===p2[1] && (mz===other.pos[2]||mz===other.pos[2]+od))) {
                             const overlap = p1[0]===p2[0] ? Math.max(0, Math.min(Math.max(p1[1],p2[1]), other.pos[2]+od)-Math.max(Math.min(p1[1],p2[1]),other.pos[2])) : Math.max(0, Math.min(Math.max(p1[0],p2[0]), other.pos[0]+ow)-Math.max(Math.min(p1[0],p2[0]),other.pos[0]));
                             if (overlap > 0.1) isExterior = false;
                          }
                       }
                    });
                    if (isExterior) {
                        const h1 = heightAt(p1[0], p1[1]), h2 = heightAt(p2[0], p2[1]);
                        if (h1 > 0.01 || h2 > 0.01) {
                            skirts3D.push([
                                { x: p1[0], y: 0, z: p1[1] }, { x: p2[0], y: 0, z: p2[1] },
                                { x: p2[0], y: h2, z: p2[1] }, { x: p1[0], y: h1, z: p1[1] }
                            ]);
                        }
                    }
                }
            });
        });

        unifiedRoofs.push({ yBase, polygons3D: polys3D, skirts3D });
    });

    return unifiedRoofs;
}

export const isSkeletonReady = true;
