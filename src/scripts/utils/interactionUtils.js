// utils/interactionUtils.js

import * as Constants from './constants.js';
import { toScreenCoords, toCartesianCoords } from './coordinates.js';
import { updateTextMetrics } from './textUtils.js';

/**
 * Checks if a point (Cartesian) is within the bounds of a rect or image element.
 */
export function isRectHit(el, cartX, cartY) {
    if (typeof el.width !== 'number' || typeof el.height !== 'number') return false;
    // Assuming el.x, el.y are the *center* coordinates
    return cartX >= el.x - el.width / 2 && cartX <= el.x + el.width / 2 &&
           cartY >= el.y - el.height / 2 && cartY <= el.y + el.height / 2;
}

/**
 * Checks if a point (Screen) is within the bounds of a text element.
 * Needs the renderer instance to access coordinate conversion and context.
 */
export function isTextHit(renderer, el, screenX, screenY) {
    // Ensure metrics are calculated if they haven't been
    if (typeof el.paddedWidth === 'undefined') {
        updateTextMetrics(renderer.ctx, el);
    }
    const { left, top, width, height } = getElementScreenBounds(renderer, el);
    if (left === null) return false; // Should not happen if metrics are updated

    return screenX >= left && screenX <= left + width &&
           screenY >= top && screenY <= top + height;
}

/**
 * Gets the screen coordinates and dimensions of resize handles for an element.
 * Needs the renderer instance for coordinate conversion.
 */
export function getResizeHandles(renderer, element) {
    // Only images are resizable in this implementation
    if (element.type !== 'image' || typeof element.width !== 'number') return [];

    const screenCenter = toScreenCoords(element.x, element.y, renderer.originX, renderer.originY);
    const halfW = element.width / 2;
    const halfH = element.height / 2;

    // Define handles relative to screen center
    return [
        { type: 'nw', x: screenCenter.x - halfW, y: screenCenter.y - halfH }, // Top-left
        { type: 'ne', x: screenCenter.x + halfW, y: screenCenter.y - halfH }, // Top-right
        { type: 'sw', x: screenCenter.x - halfW, y: screenCenter.y + halfH }, // Bottom-left
        { type: 'se', x: screenCenter.x + halfW, y: screenCenter.y + halfH }  // Bottom-right
    ];
}

/**
 * Checks if a screen point hits a specific resize handle.
 */
export function isHandleHit(screenX, screenY, handle) {
    const halfHandle = Constants.HANDLE_SIZE / 2;
    return screenX >= handle.x - halfHandle && screenX <= handle.x + halfHandle &&
           screenY >= handle.y - halfHandle && screenY <= handle.y + halfHandle;
}


/**
 * Finds which resize handle (if any) is at the given screen coordinates for a specific element.
 * Needs the renderer instance.
 */
export function getHandleAtScreenCoords(renderer, screenX, screenY, element) {
    if (!element || element.type !== 'image') return null; // Only check handles for selected images

    const handles = getResizeHandles(renderer, element);
    for (const handle of handles) {
        if (isHandleHit(screenX, screenY, handle)) {
            return handle; // Return the handle object { type, x, y }
        }
    }
    return null;
}


/**
 * Finds the topmost element at the given screen coordinates. Checks handles first if an element is selected.
 * Needs the renderer instance.
 */
export function getElementAtScreenCoords(renderer, screenX, screenY) {
    // Check if the click is on the editing overlay first
    const overlay = document.querySelector('.edit-overlay');
    if (overlay && renderer.editingElement) {
        const overlayRect = overlay.getBoundingClientRect();
         // Adjust screen coords relative to viewport if canvas has border/margin
         const canvasRect = renderer.canvas.getBoundingClientRect();
         const adjustedScreenX = screenX + canvasRect.left;
         const adjustedScreenY = screenY + canvasRect.top;

        if (adjustedScreenX >= overlayRect.left && adjustedScreenX <= overlayRect.right &&
            adjustedScreenY >= overlayRect.top && adjustedScreenY <= overlayRect.bottom) {
            return renderer.editingElement; // Click is on the active text editor
        }
    }


    // Check handles of the *selected* element first (only images are resizable here)
    if (renderer.selectedElement && renderer.selectedElement.type === 'image') {
        const handleInfo = getHandleAtScreenCoords(renderer, screenX, screenY, renderer.selectedElement);
        if (handleInfo) {
            // Return an object indicating it's a handle hit
            return { element: renderer.selectedElement, handleType: handleInfo.type };
        }
    }

    // If not hitting a handle or overlay, check elements themselves
    const cartesian = toCartesianCoords(screenX, screenY, renderer.originX, renderer.originY);

    // Iterate backwards to hit topmost element first
    for (let i = renderer.elements.length - 1; i >= 0; i--) {
        const el = renderer.elements[i];
        // Don't hit the element currently being edited (covered by overlay check)
        if (el === renderer.editingElement) continue;

        let hit = false;
        if (el.type === "text") {
            hit = isTextHit(renderer, el, screenX, screenY);
        } else if (el.type === "rect" || el.type === "image") {
            hit = isRectHit(el, cartesian.x, cartesian.y);
        }

        if (hit) {
            return el; // Return the element object itself
        }
    }

    return null; // Nothing hit
}

/**
 * Calculates the screen bounding box of an element.
 * Needs the renderer instance.
 */
export function getElementScreenBounds(renderer, element) {
    const pos = toScreenCoords(element.x, element.y, renderer.originX, renderer.originY);
    let left, top, width, height;

    if (element.type === "text") {
        // Ensure metrics are up-to-date
        if (typeof element.paddedWidth === 'undefined') {
            updateTextMetrics(renderer.ctx, element);
        }
        width = element.paddedWidth;
        height = element.paddedHeight;
        // Calculate top-left corner based on alignment
        switch (element.textAlign) {
            case 'left': left = pos.x - element.padding; break;
            case 'center': left = pos.x - width / 2; break;
            case 'right': left = pos.x - element.maxWidth - element.padding; break; // Use maxWidth for right alignment ref point
            default: left = pos.x - width / 2; // Default to center
        }
        switch (element.textBaseline) {
            case 'top': top = pos.y - element.padding; break;
            case 'middle': top = pos.y - height / 2; break;
            case 'bottom': top = pos.y - element.totalHeight - element.padding; break; // Use totalHeight for bottom alignment ref point
            default: top = pos.y - height / 2; // Default to middle
        }
    } else if (element.type === "rect" || element.type === "image") {
        if (typeof element.width !== 'number' || typeof element.height !== 'number') {
            return { left: null, top: null, width: 0, height: 0 }; // Invalid bounds
        }
        width = element.width;
        height = element.height;
        left = pos.x - width / 2; // Center X to Left
        top = pos.y - height / 2; // Center Y to Top
    } else {
        return { left: null, top: null, width: 0, height: 0 }; // Unknown type
    }

    // Add extra margin for selection handles/border if the element is selected
    // Only for images in this implementation
    if (element === renderer.selectedElement && element.type === 'image') {
        const handleMargin = Constants.HANDLE_SIZE / 2;
        const borderMargin = Constants.SELECTION_LINE_WIDTH;
        const totalMargin = handleMargin + borderMargin + 1; // Add a small buffer
        left -= totalMargin;
        top -= totalMargin;
        width += totalMargin * 2;
        height += totalMargin * 2;
    }

     return {
        left: Math.floor(left),
        top: Math.floor(top),
        width: Math.ceil(width),
        height: Math.ceil(height)
     };
}


/**
 * Calculates new dimensions and position during resize.
 * Needs the renderer instance for coordinate conversion.
 */
export function calculateNewDimensions(renderer, handleType, currentMouseX, currentMouseY, startMouse, original, maintainAspect) {
    const currentCart = toCartesianCoords(currentMouseX, currentMouseY, renderer.originX, renderer.originY);
    const startCart = toCartesianCoords(startMouse.x, startMouse.y, renderer.originX, renderer.originY);

    // Deltas in Cartesian coordinates indicate the direction and magnitude of mouse movement
    const deltaX = currentCart.x - startCart.x;
    const deltaY = currentCart.y - startCart.y;

    let newX = original.x;
    let newY = original.y;
    let newWidth = original.width;
    let newHeight = original.height;

    const aspect = (original.height > 0) ? original.width / original.height : 1;

    // Adjust width/height based on handle and delta
    // Note: signs depend on Cartesian system (positive Y is up)
    if (handleType.includes('e')) newWidth += deltaX; // East handles affect width positively with deltaX
    if (handleType.includes('w')) newWidth -= deltaX; // West handles affect width negatively with deltaX

    if (handleType.includes('n')) newHeight += deltaY; // North handles affect height positively with deltaY
    if (handleType.includes('s')) newHeight -= deltaY; // South handles affect height negatively with deltaY

    // Enforce minimum size
    newWidth = Math.max(Constants.MIN_RESIZE_SIZE, newWidth);
    newHeight = Math.max(Constants.MIN_RESIZE_SIZE, newHeight);

    // Maintain aspect ratio if requested
    if (maintainAspect && original.width > 0 && original.height > 0) {
        // Determine dominant change direction (or use width change as default)
        // We compare the *scaled* deltas to account for aspect ratio
        if (Math.abs(deltaX / original.width) > Math.abs(deltaY / original.height)) {
             // Width change is dominant
             newHeight = newWidth / aspect;
        } else {
             // Height change is dominant
             newWidth = newHeight * aspect;
        }
         // Re-check min size after aspect ratio adjustment
         newWidth = Math.max(Constants.MIN_RESIZE_SIZE, newWidth);
         newHeight = Math.max(Constants.MIN_RESIZE_SIZE, newHeight);
    }


    // Calculate the new center coordinates (x, y) based on the handle being dragged
    // The fixed point is the corner *opposite* the handle being dragged.
    // Calculate the change in half-width and half-height
    const dw = (newWidth - original.width) / 2;
    const dh = (newHeight - original.height) / 2;

    // Adjust center based on which handle was moved
    if (handleType.includes('w')) newX -= dw; else newX += dw; // West moves center left, East moves center right
    if (handleType.includes('n')) newY += dh; else newY -= dh; // North moves center up, South moves center down


    return { x: newX, y: newY, width: newWidth, height: newHeight };
}

/**
 * Returns the appropriate CSS cursor style for a resize handle type.
 */
export function getResizeCursor(handleType) {
    // Standard cursor names for resize handles
    const cursors = {
        'nw': 'nwse-resize', 'ne': 'nesw-resize',
        'sw': 'nesw-resize', 'se': 'nwse-resize'
    };
    return cursors[handleType] || 'default'; // Default cursor if handle type is unknown
}