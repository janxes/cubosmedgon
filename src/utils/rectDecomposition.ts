// rectDecomposition.ts
// Decomposes a set of connected grid cells into maximal axis-aligned rectangles.
export type Rect = { x: number, z: number, w: number, d: number };

export function decomposeIntoRectangles(cells: {x: number, z: number}[]): Rect[] {
    if (cells.length === 0) return [];
    
    // Create a set for fast lookup
    const cellSet = new Set<string>();
    cells.forEach(c => cellSet.add(`${c.x},${c.z}`));
    
    let remaining = new Set(cellSet);
    const rects: Rect[] = [];
    
    while (remaining.size > 0) {
        // Pick any starting cell
        const startKey = Array.from(remaining)[0];
        const [startX, startZ] = startKey.split(',').map(Number);
        
        let bestRect: Rect = { x: startX, z: startZ, w: 1, d: 1 };
        let maxArea = 0;
        
        // Find the bounding box of remaining components to restrict search space
        let minX = startX, maxX = startX, minZ = startZ, maxZ = startZ;
        remaining.forEach(key => {
            const [x, z] = key.split(',').map(Number);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        });

        // Search all possible rectangles spanning within the bounding box exactly on remaining cells
        // A naive approach: for every remaining cell, try expanding X, then Z, and expanding Z, then X.
        remaining.forEach(key => {
            const [x, z] = key.split(',').map(Number);
            
            // Try expanding in +X then +Z
            let w = 1;
            while (remaining.has(`${x + w},${z}`)) w++;
            let d = 1;
            let valid = true;
            while(valid) {
                for(let ix = 0; ix < w; ix++) {
                    if (!remaining.has(`${x + ix},${z + d}`)) {
                        valid = false;
                        break;
                    }
                }
                if (valid) d++;
            }
            if (w * d > maxArea) {
                maxArea = w * d;
                bestRect = { x, z, w, d };
            }

            // Try expanding in +Z then +X
            let d2 = 1;
            while (remaining.has(`${x},${z + d2}`)) d2++;
            let w2 = 1;
            valid = true;
            while(valid) {
                for(let iz = 0; iz < d2; iz++) {
                    if (!remaining.has(`${x + w2},${z + iz}`)) {
                        valid = false;
                        break;
                    }
                }
                if (valid) w2++;
            }
            if (w2 * d2 > maxArea) {
                maxArea = w2 * d2;
                bestRect = { x, z, w: w2, d: d2 };
            }
        });

        rects.push(bestRect);
        
        // Remove covered cells
        for(let ix = 0; ix < bestRect.w; ix++) {
            for(let iz = 0; iz < bestRect.d; iz++) {
                remaining.delete(`${bestRect.x + ix},${bestRect.z + iz}`);
            }
        }
    }
    
    // Sort rects by area descending so the largest "main limb" comes first
    rects.sort((a, b) => (b.w * b.d) - (a.w * a.d));
    return rects;
}
