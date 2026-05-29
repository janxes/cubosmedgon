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
    skirts3D?: Roof3DPolygon[];
};

// No pointToLineDistance needed, time property of vertex contains orthogonal distance.

// Area calculation removed as polygon-clipping handles correct CCW/CW orientations.

import * as THREE from 'three';

export function generateUnifiedRoofs(cubes: CubeModule[]): UnifiedRoof[] {
    if (!isSkeletonReady) return [];
    const roofCubes = cubes.filter(c => c.roofType && c.roofType !== 'none');
    if (roofCubes.length === 0) return [];

    // Map all covered cells with highest Y and their roofType
    // For simplicity, we prioritize the roofType of the module that defines the max Y.
    const maxHTable = new Map<string, { y: number, roofType: string }>();

    roofCubes.forEach(c => {
        const [w, h, d] = getGridBounds(c.type, c.rot);
        for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
                const nx = c.pos[0] + dx;
                const nz = c.pos[2] + dz;
                const ny = c.pos[1] + h; 
                const key = `${Math.round(nx)},${Math.round(nz)}`;
                const current = maxHTable.get(key) || { y: 0, roofType: 'none' };
                if (ny > current.y) {
                    maxHTable.set(key, { y: ny, roofType: c.roofType! });
                }
            }
        }
    });

    // Group cells by Y + roofType level
    const groups = new Map<string, { x: number, z: number, y: number, roofType: string }[]>();
    maxHTable.forEach((data, key) => {
        const [x, z] = key.split(',').map(Number);
        const groupKey = `${data.y}_${data.roofType}`;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey)!.push({ x, z, y: data.y, roofType: data.roofType });
    });

    const unifiedRoofs: UnifiedRoof[] = [];
    const pitch = 15 * (Math.PI / 180);

    // Group cells by yBase specifically, so we don't mix floors for the global boundaries
    const floors = new Map<number, typeof groups>();
    groups.forEach((cells, groupKey) => {
        const y = cells[0].y;
        if (!floors.has(y)) floors.set(y, new Map());
        floors.get(y)!.set(groupKey, cells);
    });

    floors.forEach((floorGroups, yBase) => {
        // Collect all cells for this floor
        const allFloorCells: {x: number, z: number}[] = [];
        floorGroups.forEach(cells => allFloorCells.push(...cells));
        
        const allInnerRects: polygonClipping.Geom[] = allFloorCells.map(c => [[
            [c.x, c.z],
            [c.x + 1, c.z],
            [c.x + 1, c.z + 1],
            [c.x, c.z + 1],
            [c.x, c.z] 
        ]]);
        const globalInnerUnion = allInnerRects.length > 0 ? polygonClipping.union(allInnerRects[0], ...allInnerRects.slice(1)) : [];

        const isSegmentOnGlobalBoundary = (p1: [number, number], p2: [number, number]) => {
            const midX = (p1[0] + p2[0]) / 2;
            const midZ = (p1[1] + p2[1]) / 2;
            const EPSILON = 0.001;
            for (const poly of globalInnerUnion) {
                for (const ring of poly) {
                    for (let i = 0; i < ring.length - 1; i++) {
                        const rp1 = ring[i];
                        const rp2 = ring[i+1];
                        
                        const crossProduct = Math.abs((midZ - rp1[1]) * (rp2[0] - rp1[0]) - (midX - rp1[0]) * (rp2[1] - rp1[1]));
                        if (crossProduct > EPSILON) continue;
                        
                        const dotProduct = (midX - rp1[0]) * (rp2[0] - rp1[0]) + (midZ - rp1[1]) * (rp2[1] - rp1[1]);
                        if (dotProduct < -EPSILON) continue;
                        
                        const squaredLength = (rp2[0] - rp1[0]) ** 2 + (rp2[1] - rp1[1]) ** 2;
                        if (dotProduct > squaredLength + EPSILON) continue;
                        
                        return true;
                    }
                }
            }
            return false;
        };

        floorGroups.forEach((cells, groupKey) => {
            const roofType = cells[0].roofType;
        
        // Configuracion de alero (overhang): 0.5 metros
        const overhangMeters = 0.5; 
        const overhang = overhangMeters / 1.5; // Convertir a unidades de grid (cada grid unit es 1.5m)

        // Create polygon for each cell without overhang (for vertical skirts)
        const innerRects: polygonClipping.Geom[] = cells.map(c => [[
            [c.x, c.z],
            [c.x + 1, c.z],
            [c.x + 1, c.z + 1],
            [c.x, c.z + 1],
            [c.x, c.z] 
        ]]);
        const innerUnion = polygonClipping.union(innerRects[0], ...innerRects.slice(1));

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
                
                if (roofType === 'hip') {
                    const skeleton = SkeletonBuilder.buildFromPolygon(formattedPoly);
                    if (!skeleton) return;
                    
                    const verts = skeleton.vertices;
                    const polys3D: Roof3DPolygon[] = skeleton.polygons.map((skelPolyIndices: number[]) => {
                        return skelPolyIndices.map(idx => {
                            const v = verts[idx];
                            const height = (v[2] - overhang) * Math.tan(pitch);
                            return { x: v[0], y: height, z: v[1] };
                        });
                    });
                    
                    unifiedRoofs.push({ yBase, polygons3D: polys3D });
                } else {
                    // PITCHED ROOF 1 AGUA
                    const contour = formattedPoly[0].map(pt => new THREE.Vector2(pt[0], pt[1]));
                    // polygonClipping sometimes returns redundant last points. THREE handles this, but just in case.
                    const holes = formattedPoly.slice(1).map(h => h.map(pt => new THREE.Vector2(pt[0], pt[1])));
                    
                    const indices = THREE.ShapeUtils.triangulateShape(contour, holes);
                    const allPts = [...formattedPoly[0]];
                    for(let i=1; i<formattedPoly.length; i++) allPts.push(...formattedPoly[i]);
                    
                    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
                    allPts.forEach(pt => {
                        if(pt[0]<minX) minX = pt[0];
                        if(pt[0]>maxX) maxX = pt[0];
                        if(pt[1]<minZ) minZ = pt[1];
                        if(pt[1]>maxZ) maxZ = pt[1];
                    });

                    const heightAt = (x: number, z: number) => {
                        let height = 0;
                        if (roofType === 'shed_n') {
                            height = (z - (minZ + overhang)) * Math.tan(pitch);
                        } else if (roofType === 'shed_s') {
                            height = ((maxZ - overhang) - z) * Math.tan(pitch);
                        } else if (roofType === 'shed_w') {
                            height = (x - (minX + overhang)) * Math.tan(pitch);
                        } else if (roofType === 'shed_e') {
                            height = ((maxX - overhang) - x) * Math.tan(pitch);
                        }
                        return height;
                    };

                    const polys3D: Roof3DPolygon[] = [];
                    indices.forEach(tri => {
                        const p3d = tri.map(idx => {
                            const pt = allPts[idx];
                            return { x: pt[0], y: heightAt(pt[0], pt[1]), z: pt[1] };
                        });
                        polys3D.push(p3d);
                    });
                    
                    const skirts3D: Roof3DPolygon[] = [];
                    innerUnion.forEach(innerPoly => {
                        innerPoly.forEach(ring => {
                            for (let i = 0; i < ring.length - 1; i++) {
                                const p1 = ring[i];
                                const p2 = ring[i + 1];
                                
                                // Only draw vertical skirts if this segment is on the global exterior boundary of the building
                                if (isSegmentOnGlobalBoundary(p1, p2)) {
                                    const h1 = heightAt(p1[0], p1[1]);
                                    const h2 = heightAt(p2[0], p2[1]);
                                    
                                    skirts3D.push([
                                        { x: p1[0], y: 0, z: p1[1] },
                                        { x: p2[0], y: 0, z: p2[1] },
                                        { x: p2[0], y: h2, z: p2[1] },
                                        { x: p1[0], y: h1, z: p1[1] }
                                    ]);
                                }
                            }
                        });
                    });
                    
                    unifiedRoofs.push({ yBase, polygons3D: polys3D, skirts3D });
                }
            } catch (e) {
                console.error("Error building roof", e);
            }
        });
    });
    });

    return unifiedRoofs;
}
