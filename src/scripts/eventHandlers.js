// eventHandlers.js
import { getElementAtScreenCoords, calculateNewDimensions, getResizeCursor, getHandleAtScreenCoords } from './utils/interactionUtils.js';
import { toCartesianCoords } from './utils/coordinates.js';
import { markDirty, markEntireCanvasDirty } from './dirtyRegions.js';
import { startEditing, stopEditing, updateEditOverlay } from './editing.js';

// Factory functions to create event handlers that close over the renderer instance

export function createMouseDownHandler(renderer) {
    return function handleMouseDown(event) {
        const overlay = document.querySelector('.edit-overlay');
        const isClickOnOverlay = overlay && event.target === overlay;
        const isClickOnCanvas = event.target === renderer.canvas;

        // If editing and click is *outside* the overlay, stop editing
        if (renderer.editingElement && !isClickOnOverlay) {
            // Use a minimal timeout to allow double-click detection or other interactions
             setTimeout(() => {
                 // Re-check if still editing and focus hasn't returned to overlay
                 if (renderer.editingElement && document.activeElement !== overlay) {
                     stopEditing(renderer);
                 }
             }, 50);
             // Don't process canvas interaction if click was outside editing overlay
             if (!isClickOnCanvas) return;
        }


        const rect = renderer.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        // If editing text, don't allow selecting/dragging other elements
        if (renderer.editingElement) {
            // Allow clicking off to stop editing (handled above)
             if (!isClickOnOverlay) {
                 // Potentially deselect if click was on empty canvas space
                 // This logic might be redundant with the stopEditing check above
             }
            return; // Prevent further interaction while editing overlay is active
        }

        // --- Interaction with Canvas Elements ---
        const hitInfo = getElementAtScreenCoords(renderer, screenX, screenY);

        // Case 1: Clicked on a resize handle
        if (hitInfo && hitInfo.handleType) {
            const element = hitInfo.element;
            if (element.type === 'image') { // Only images are resizable
                renderer.resizing = true;
                renderer.resizeHandleType = hitInfo.handleType;
                renderer.selectedElement = element; // Ensure element is selected
                renderer.originalDimensions = { x: element.x, y: element.y, width: element.width, height: element.height };
                renderer.startMousePos = { x: screenX, y: screenY };
                renderer.dragging = false; // Not dragging the element itself
                renderer.canvas.style.cursor = getResizeCursor(hitInfo.handleType);
                console.log(`Started resizing element ${element.id} via ${hitInfo.handleType} handle`);
                markDirty(renderer, element); // Mark for redraw (selection handles)
            }
        }
        // Case 2: Clicked on an element (not a handle)
        else if (hitInfo && typeof hitInfo.handleType === 'undefined') {
            const element = hitInfo;
            // Select the element if it's not already selected
            if (renderer.selectedElement !== element) {
                if (renderer.selectedElement) markDirty(renderer, renderer.selectedElement); // Mark old selection dirty
                renderer.selectedElement = element;
                markDirty(renderer, renderer.selectedElement); // Mark new selection dirty
                console.log(`Selected ${element.type} ID ${element.id}`);
            } else {
                 console.log(`Clicked already selected ${element.type} ID ${element.id}`);
            }

            // Start dragging the selected element
            renderer.dragging = true;
            const cartesianClick = toCartesianCoords(screenX, screenY, renderer.originX, renderer.originY);
            // Calculate offset from element's *center*
            renderer.dragOffsetX = cartesianClick.x - element.x;
            renderer.dragOffsetY = cartesianClick.y - element.y;
            renderer.canvas.style.cursor = 'grabbing';
            renderer.resizing = false; // Ensure not resizing
        }
        // Case 3: Clicked on empty space
        else {
            console.log("Clicked empty space - deselecting");
            if (renderer.selectedElement) {
                markDirty(renderer, renderer.selectedElement); // Mark old selection dirty for redraw
                renderer.selectedElement = null;
                markEntireCanvasDirty(renderer); // Redraw needed to remove selection viz
            }
            renderer.dragging = false;
            renderer.resizing = false;
            renderer.canvas.style.cursor = 'default';
        }
    };
}

export function createMouseMoveHandler(renderer) {
    return function handleMouseMove(event) {
        const rect = renderer.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        // --- Handle Resizing ---
        if (renderer.resizing && renderer.selectedElement) {
            markDirty(renderer, renderer.selectedElement); // Mark old position/size dirty

            // Calculate new dimensions based on mouse movement
            const newDims = calculateNewDimensions(
                renderer, // Pass renderer instance
                renderer.resizeHandleType,
                screenX, screenY,
                renderer.startMousePos,
                renderer.originalDimensions,
                event.shiftKey // Maintain aspect ratio if Shift is pressed
            );

            // Update element properties
            renderer.selectedElement.x = newDims.x;
            renderer.selectedElement.y = newDims.y;
            renderer.selectedElement.width = newDims.width;
            renderer.selectedElement.height = newDims.height;

            markDirty(renderer, renderer.selectedElement); // Mark new position/size dirty
            renderer.canvas.style.cursor = getResizeCursor(renderer.resizeHandleType); // Keep resize cursor
        }
        // --- Handle Dragging ---
        else if (renderer.dragging && renderer.selectedElement) {
            markDirty(renderer, renderer.selectedElement); // Mark old position dirty

            const cartesianMouse = toCartesianCoords(screenX, screenY, renderer.originX, renderer.originY);
            // Update element center position based on drag offset
            renderer.selectedElement.x = cartesianMouse.x - renderer.dragOffsetX;
            renderer.selectedElement.y = cartesianMouse.y - renderer.dragOffsetY;

            markDirty(renderer, renderer.selectedElement); // Mark new position dirty
            renderer.canvas.style.cursor = 'grabbing'; // Keep grabbing cursor

             // If editing overlay is somehow active during drag (shouldn't happen often), update its position
             if (renderer.editingElement === renderer.selectedElement) {
                 updateEditOverlay(renderer);
             }
        }
        // --- Handle Hover Effects (Cursor Changes) ---
        else if (!renderer.editingElement) { // Only change cursor if not editing text
            const hitInfo = getElementAtScreenCoords(renderer, screenX, screenY);

            if (hitInfo && hitInfo.handleType) {
                renderer.canvas.style.cursor = getResizeCursor(hitInfo.handleType);
            } else if (hitInfo) {
                renderer.canvas.style.cursor = 'move'; // Hovering over a movable element
            } else {
                renderer.canvas.style.cursor = 'default'; // Hovering over empty space
            }
        }
         // If editing, keep cursor as 'text' or whatever the overlay has
         else if (renderer.editingElement) {
              const overlay = document.querySelector('.edit-overlay');
              if (overlay && overlay.contains(event.target)) {
                 // Let browser handle cursor within textarea
              } else {
                 renderer.canvas.style.cursor = 'default'; // Or specific cursor outside overlay?
              }
         }
    };
}

export function createMouseUpHandler(renderer) {
    return function handleMouseUp(event) {
        let needsRedrawForDeselect = false;

        // --- Finalize Resizing ---
        if (renderer.resizing && renderer.selectedElement) {
            console.log(`Finished resizing element ${renderer.selectedElement.id}`);
            renderer.resizing = false;
            // Reset temporary resize state
            renderer.resizeHandleType = null;
            renderer.originalDimensions = null;
            renderer.startMousePos = null;
            // Mark final state dirty (might be redundant, but safe)
            markDirty(renderer, renderer.selectedElement);
            // Set cursor based on final mouse position (hover check)
            const rect = renderer.canvas.getBoundingClientRect();
             const screenX = event.clientX - rect.left;
             const screenY = event.clientY - rect.top;
             const hitInfo = getElementAtScreenCoords(renderer, screenX, screenY);
              if (hitInfo && hitInfo.handleType) renderer.canvas.style.cursor = getResizeCursor(hitInfo.handleType);
             else if (hitInfo === renderer.selectedElement) renderer.canvas.style.cursor = 'move';
             else renderer.canvas.style.cursor = 'default';
        }
        // --- Finalize Dragging ---
        else if (renderer.dragging && renderer.selectedElement) {
            console.log(`Finished dragging ${renderer.selectedElement.type} ID ${renderer.selectedElement.id}`);
            renderer.dragging = false;
            // Reset temporary drag state
            renderer.dragOffsetX = 0;
            renderer.dragOffsetY = 0;
             // Mark final state dirty
             markDirty(renderer, renderer.selectedElement);
            // Set cursor to 'move' as the element is still selected
            renderer.canvas.style.cursor = 'move';
        }
        // --- Handle Deselection on Click Up in Empty Space ---
        else if (!renderer.dragging && !renderer.resizing && !renderer.editingElement && renderer.selectedElement) {
            // Check if the mouse up occurred over empty space
             const rect = renderer.canvas.getBoundingClientRect();
             const screenX = event.clientX - rect.left;
             const screenY = event.clientY - rect.top;
             const hitInfo = getElementAtScreenCoords(renderer, screenX, screenY);
             if (!hitInfo) { // Only deselect if click up is on nothing
                 console.log("Mouse up on empty space after click - deselecting");
                 markDirty(renderer, renderer.selectedElement); // Mark old selection for redraw
                 renderer.selectedElement = null;
                 needsRedrawForDeselect = true; // Need redraw to remove selection viz
                 renderer.canvas.style.cursor = 'default';
             }
        }


        // If deselection happened, request a redraw
        if (needsRedrawForDeselect) {
            markEntireCanvasDirty(renderer); // Use full redraw for simplicity on deselect
        }
    };
}

export function createMouseLeaveHandler(renderer) {
     // Often, mouseleave can be treated like a mouseup (stop dragging/resizing)
    return function handleMouseLeave(event) {
         if (renderer.resizing || renderer.dragging) {
             console.log("Mouse left canvas during drag/resize - finalizing action.");
              // Simulate a MouseUp event to finalize the state
              createMouseUpHandler(renderer)(event); // Call the mouseup logic
              renderer.canvas.style.cursor = 'default'; // Reset cursor when leaving canvas
         }
         // If just hovering, reset cursor
         else if (!renderer.editingElement) {
            renderer.canvas.style.cursor = 'default';
         }
     };
}

export function createDoubleClickHandler(renderer) {
    return function handleDoubleClick(event) {
         // Prevent double-click from triggering drag start
         renderer.dragging = false;
         renderer.canvas.style.cursor = 'default'; // Reset cursor initially


        const overlay = document.querySelector('.edit-overlay');
        const isClickOnOverlay = overlay && event.target === overlay;

        // Do nothing if double-clicking inside the text editor overlay
        if (isClickOnOverlay) return;

        // Stop existing edit if double-clicking elsewhere
        if (renderer.editingElement && !isClickOnOverlay) {
            stopEditing(renderer);
        }

        const rect = renderer.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        // Check what was double-clicked (ignoring handles)
        const element = getElementAtScreenCoords(renderer, screenX, screenY);

         // Start editing if double-clicking a text element (and not a handle)
         if (element && typeof element.handleType === 'undefined' && element.type === "text") {
            startEditing(renderer, element); // Pass the renderer instance and element
         }
          // If double-clicking something else or empty space, ensure cursor is appropriate
         else {
              const handleInfo = getHandleAtScreenCoords(renderer, screenX, screenY, renderer.selectedElement);
              if (handleInfo) {
                 renderer.canvas.style.cursor = getResizeCursor(handleInfo.type); // Cursor over handle
              } else if (element && typeof element.handleType === 'undefined') {
                 renderer.canvas.style.cursor = 'move'; // Cursor over element
              } else {
                 renderer.canvas.style.cursor = 'default'; // Cursor over empty space
              }
         }
    };
}

export function createResizeHandler(renderer) {
    return function handleResize() {
        // Mark everything dirty on resize
        markEntireCanvasDirty(renderer);
        // Recalculate canvas size and origin
        renderer.setupCanvas(); // Let the renderer handle canvas dimension updates
        // If editing, reposition the overlay
        if (renderer.editingElement) {
            updateEditOverlay(renderer);
        }
        // No need to explicitly call draw here, the animation loop will handle it
    };
}