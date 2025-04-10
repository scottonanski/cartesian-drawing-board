// dirtyRegions.js
import { getElementScreenBounds } from './utils/interactionUtils.js';

/** Marks the screen area occupied by an element as dirty */
export function markDirty(renderer, element) {
    const bounds = getElementScreenBounds(renderer, element);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return; // Ignore if no valid bounds

    const buffer = 2; // Small buffer to avoid artifacts
    renderer.dirtyRegions.push({
        x: Math.floor(bounds.left - buffer),
        y: Math.floor(bounds.top - buffer),
        width: Math.ceil(bounds.width + buffer * 2),
        height: Math.ceil(bounds.height + buffer * 2)
    });
}

/** Marks the entire canvas as dirty for a full redraw */
export function markEntireCanvasDirty(renderer) {
    renderer.fullRedraw = true;
    // Optional: Clear specific regions and just add one large one
    renderer.dirtyRegions = [{ x: 0, y: 0, width: renderer.canvas.width, height: renderer.canvas.height }];
}

/** Checks if two rectangular regions overlap */
export function regionsOverlap(a, b) {
     // Check for non-overlap conditions
    return !(
        a.x + a.width < b.x ||  // A is entirely left of B
        b.x + b.width < a.x ||  // B is entirely left of A
        a.y + a.height < b.y || // A is entirely above B
        b.y + b.height < a.y    // B is entirely above A
    );
}

/** Combines two overlapping regions into a single bounding region */
export function combineRegions(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const bottom = Math.max(a.y + a.height, b.y + b.height);
    return {
        x: x,
        y: y,
        width: right - x,
        height: bottom - y
    };
}

/** Merges a list of potentially overlapping regions into a smaller list of combined regions */
export function mergeRegions(regions) {
    if (regions.length <= 1) return regions;

    let merged = [];
    let currentRegions = [...regions]; // Work on a copy
    let didMerge;

    do {
        didMerge = false;
        merged = []; // Start fresh for this pass
        const processed = new Array(currentRegions.length).fill(false);

        for (let i = 0; i < currentRegions.length; i++) {
            if (processed[i]) continue; // Skip if already merged into another region

            let baseRegion = { ...currentRegions[i] }; // Start with the current region
            processed[i] = true;

            // Try to merge subsequent regions into this baseRegion
            for (let j = i + 1; j < currentRegions.length; j++) {
                if (processed[j]) continue; // Skip if already processed

                if (regionsOverlap(baseRegion, currentRegions[j])) {
                    baseRegion = combineRegions(baseRegion, currentRegions[j]);
                    processed[j] = true; // Mark region j as processed (merged)
                    didMerge = true; // Signal that a merge occurred in this pass
                }
            }
            merged.push(baseRegion); // Add the (potentially combined) region to the result
        }
        currentRegions = merged; // Use the merged list for the next pass
    } while (didMerge); // Repeat until no more merges can be done

    return merged; // Return the final list of non-overlapping combined regions
}