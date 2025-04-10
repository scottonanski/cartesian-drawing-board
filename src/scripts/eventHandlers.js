// eventHandlers.js
import { getElementAtScreenCoords, calculateNewDimensions, getResizeCursor, getHandleAtScreenCoords } from './utils/interactionUtils.js';
import { toCartesianCoords } from './utils/coordinates.js';
import { markDirty, markEntireCanvasDirty } from './dirtyRegions.js';
import { startEditing, stopEditing, updateEditOverlay } from './editing.js';

// Functions to create event handlers that close over the renderer instance
export function createMouseMoveHandler(renderer) {
    // This function returns the actual event listener
    return function handleMouseMove(event) {
        // Get mouse position relative to the canvas
        const rect = renderer.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        // Convert screen coordinates to Cartesian coordinates
        const cartesianPoint = renderer.toCartesianCoords(screenX, screenY);

        // Store the latest Cartesian mouse position in the renderer
        // This is needed for the live preview of the reflected P2
        renderer.currentMousePosCartesian = cartesianPoint;

        // --- Handle Pen Tool Dragging ---
        if (renderer.currentTool === 'pen') {
            // Check the current drawing phase
            if (renderer.bezierDrawingState === 'definingP1') {
                // --- Phase 1 Drag: Update P1 position ---
                // Update the first control point to follow the mouse
                renderer.currentCurvePoints.p1 = cartesianPoint;
                // Mark canvas dirty to update the preview (P0, P1 dot, P0-P1 line)
                renderer.markEntireCanvasDirty();
            } else if (renderer.bezierDrawingState === 'definingP2') {
                // --- Phase 2 Drag: Update P2 preview ---
                // We don't store P2 directly during move, the preview function
                // will calculate the reflected point based on the live mouse position.
                // Just mark dirty to trigger the preview redraw.
                renderer.markEntireCanvasDirty();
            }
            // If state is 'idle' or 'p1Defined', mouse move does nothing for pen tool

            // Stop further processing to prevent select tool hover effects
            return;
        }

        // --- Handle Select/Edit Tool Dragging/Resizing/Hover ---
        // This part only runs if currentTool is NOT 'pen'

        // Handle Resizing (if active)
        if (renderer.resizing && renderer.selectedElement) {
             // Add your resizing calculation logic here
             markDirty(renderer, renderer.selectedElement); // Mark old pos/size
             // Update element properties
             // markDirty(renderer, renderer.selectedElement); // Mark new pos/size
            renderer.canvas.style.cursor = getResizeCursor(renderer.resizeHandleType);
        }
        // Handle Dragging (if active)
        else if (renderer.dragging && renderer.selectedElement) {
             markDirty(renderer, renderer.selectedElement); // Mark old pos
             // Update element position based on drag offset
             const cartesianMouse = toCartesianCoords(screenX, screenY, renderer.originX, renderer.originY);
             renderer.selectedElement.x = cartesianMouse.x - renderer.dragOffsetX;
             renderer.selectedElement.y = cartesianMouse.y - renderer.dragOffsetY;
             markDirty(renderer, renderer.selectedElement); // Mark new pos
             // Only set grabbing cursor if select tool is active
            if (renderer.currentTool === 'select') {
                renderer.canvas.style.cursor = 'grabbing';
            }
             // Update edit overlay if dragging the element being edited
             if (renderer.editingElement === renderer.selectedElement) {
                  updateEditOverlay(renderer);
             }
        }
        // Handle Hover Effects (if not dragging/resizing/editing)
        else if (!renderer.editingElement) {
            // Only do hover cursor changes if the select tool is active
            if (renderer.currentTool === 'select') {
                // Check what's under the mouse
                const hitInfo = getElementAtScreenCoords(renderer, screenX, screenY);
                // Set cursor based on whether it's a handle, an element, or empty space
                if (hitInfo && hitInfo.handleType) {
                    renderer.canvas.style.cursor = getResizeCursor(hitInfo.handleType);
                } else if (hitInfo && typeof hitInfo.handleType === 'undefined') {
                    renderer.canvas.style.cursor = 'move';
                } else {
                    renderer.canvas.style.cursor = 'default';
                }
            }
        }
        // Handle cursor when editing text overlay is active
         else if (renderer.editingElement) {
             const overlay = document.querySelector('.edit-overlay');
              // Let browser handle cursor if mouse is inside the textarea
              if (overlay && overlay.contains(event.target)) {
                 // No action needed here
              } else {
                 // Set default cursor if mouse is outside overlay (and select tool active)
                 if (renderer.currentTool === 'select'){
                     renderer.canvas.style.cursor = 'default';
                 }
              }
         }
    };
}
export function createMouseDownHandler(renderer) {
    return function handleMouseDown(event) {
        const rect = renderer.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const cartesianPoint = renderer.toCartesianCoords(screenX, screenY);
        console.log(`MouseDown: current state = ${renderer.bezierDrawingState}`);

        // --- Handle Pen Tool Click ---
        if (renderer.currentTool === 'pen') {
            if (renderer.bezierDrawingState === 'idle') {
                // --- Start Segment: Define P0 (if needed), Start Dragging P1 ---
                renderer.bezierDrawingState = 'definingP1';
                // Use existing p0 if it exists (from previous segment end), else use click point
                renderer.currentCurvePoints.p0 = renderer.currentCurvePoints.p0 || cartesianPoint;
                // P1 always starts where the user clicks down for THIS drag
                renderer.currentCurvePoints.p1 = cartesianPoint;
                renderer.currentCurvePoints.p3 = null; // Clear p3
                console.log("Started/Continued path: P0 set, defining P1...");
                console.log("MouseDown: Set state to definingP1");
                renderer.markEntireCanvasDirty();

            } else if (renderer.bezierDrawingState === 'p1Defined') {
                // --- Start Drag for P2: Define P3 ---
                renderer.bezierDrawingState = 'definingP2';
                renderer.currentCurvePoints.p3 = cartesianPoint; // This click is P3
                renderer.currentMousePosCartesian = cartesianPoint; // P2 starts here for preview
                console.log("Set end point P3, defining P2...");
                console.log("MouseDown: Set state to definingP2");
                renderer.markEntireCanvasDirty();
            }
            return; // Pen tool handles the click
        }

        // --- Handle Select/Edit Tool ---
        // ... (Keep your existing select tool logic here) ...
    };
}

// Helper function (place this at the top of eventHandlers.js or import it)
function reflectPoint(pointToReflect, centerPoint) {
    return {
        x: centerPoint.x + (centerPoint.x - pointToReflect.x),
        y: centerPoint.y + (centerPoint.y - pointToReflect.y)
    };
}

export function createMouseUpHandler(renderer) {
    // This function returns the actual event listener
    return function handleMouseUp(event) {
        // Get mouse position relative to the canvas
        const rect = renderer.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        // Convert screen coordinates to Cartesian coordinates for the final position
        const cartesianPoint = renderer.toCartesianCoords(screenX, screenY);

        // Log the state *before* any changes in this handler
        console.log(`MouseUp: current state = ${renderer.bezierDrawingState}`);

        // --- Handle Pen Tool Release ---
        if (renderer.currentTool === 'pen') {
            // Check the drawing phase when the mouse is released
            if (renderer.bezierDrawingState === 'definingP1') {
                // --- Finalize Phase 1: Set P1 ---
                console.log("MouseUp: State is definingP1 - Finalizing P1.");
                renderer.currentCurvePoints.p1 = cartesianPoint; // Final P1
                renderer.bezierDrawingState = 'p1Defined'; // State: P0, P1 known, wait for P3 click
                console.log("MouseUp: Set state to p1Defined");
                console.log("P1 defined. Click and drag for end point (P3) and its control (P2).");
                renderer.markEntireCanvasDirty();

            } else if (renderer.bezierDrawingState === 'definingP2') {
                // --- Finalize Phase 2: Calculate Reflected P2, Create Curve, Setup Next ---
                const p0 = renderer.currentCurvePoints.p0;
                const p1 = renderer.currentCurvePoints.p1;
                const p3 = renderer.currentCurvePoints.p3;
                // Calculate the final P2 by reflecting the mouse release point (cartesianPoint)
                const p2 = reflectPoint(cartesianPoint, p3); // Use helper function

                // Add validation
                if (!p0 || !p1 || !p2 || !p3) {
                     console.error("MouseUp: Missing points before creating segment! Resetting.", { p0, p1, p2, p3 });
                     renderer.bezierDrawingState = 'idle';
                     renderer.currentCurvePoints = { p0: null, p1: null, p3: null };
                     renderer.markEntireCanvasDirty();
                     renderer.currentMousePosCartesian = null;
                     return;
                 }

                console.log("Points (P2 reflected) before calling addBezierCurve:", { p0, p1, p2, p3 });
                console.log("P2 defined (reflected). Creating curve segment.");
                renderer.addBezierCurve(p0, p1, p2, p3); // Create the element

                // --- SETUP FOR NEXT SMOOTH SEGMENT ---
                // New P0 is the old P3
                renderer.currentCurvePoints.p0 = p3;
                // New P1 is the reflection of the finalized P2 around P3
                renderer.currentCurvePoints.p1 = reflectPoint(p2, p3);
                // Clear P3, ready for the next segment's end point definition
                renderer.currentCurvePoints.p3 = null;
                // Go back to 'p1Defined' state - P0 and the new (reflected) P1 are known
                renderer.bezierDrawingState = 'p1Defined';
                console.log("MouseUp: Set state to p1Defined (for next smooth segment)");
                console.log("Segment added. New P0 and reflected P1 set. Click and drag for next P3/P2.");
                // addBezierCurve already marks dirty
            }
            // Clear the temporary live mouse position tracker
             renderer.currentMousePosCartesian = null;
            return; // Pen tool handled the mouse up
        }

        // --- Handle Select/Edit Tool Release (Keep your existing working select logic here) ---
        let needsRedrawForDeselect = false;
        let cursorShouldBeSet = true;
        if (renderer.resizing && renderer.selectedElement) { /* ... select tool resize end logic ... */ cursorShouldBeSet = true; }
        else if (renderer.dragging && renderer.selectedElement) { /* ... select tool drag end logic ... */ cursorShouldBeSet = true; }
        else if (!renderer.dragging && !renderer.resizing && !renderer.editingElement && renderer.selectedElement) {
             const hitInfoUp = getElementAtScreenCoords(renderer, screenX, screenY);
             if (!hitInfoUp) { /* ... select tool deselect logic ... */ cursorShouldBeSet = false;}
             else { cursorShouldBeSet = true; }
        }
        else if (!renderer.dragging && !renderer.resizing) { cursorShouldBeSet = true; }
        if (renderer.currentTool === 'select' && cursorShouldBeSet) { /* ... select tool final cursor setting ... */ }
        if (needsRedrawForDeselect) { markEntireCanvasDirty(renderer); }
    };
}

export function createDoubleClickHandler(renderer) {
    return function handleDoubleClick(event) {
         // Prevent double-click from triggering drag start
         renderer.dragging = false;
         // REMOVE THIS LINE: renderer.canvas.style.cursor = 'default';

        const overlay = document.querySelector('.edit-overlay');
        const isClickOnOverlay = overlay && event.target === overlay;

        if (isClickOnOverlay) return; // Do nothing if double-clicking overlay

        // Stop existing edit if double-clicking elsewhere
        if (renderer.editingElement && !isClickOnOverlay) {
            stopEditing(renderer);
            // After stopping edit, we might want the default cursor IF select tool active
            if(renderer.currentTool === 'select') {
                 renderer.canvas.style.cursor = 'default';
            }
            // Don't proceed to element check if we just stopped editing
            return;
        }

        // --- Only check elements/handles if NOT editing ---

        const rect = renderer.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const element = getElementAtScreenCoords(renderer, screenX, screenY);

         // Start editing text element (only relevant if select tool is active conceptually)
         if (renderer.currentTool === 'select' && element && typeof element.handleType === 'undefined' && element.type === "text") {
            startEditing(renderer, element);
         }
         // If not starting text edit, set cursor based on hover ONLY if select tool active
         else if (renderer.currentTool === 'select') { // << WRAP LOGIC >>
              const handleInfo = getHandleAtScreenCoords(renderer, screenX, screenY, renderer.selectedElement);
              if (handleInfo) {
                 renderer.canvas.style.cursor = getResizeCursor(handleInfo.type); // Cursor over handle
              } else if (element && typeof element.handleType === 'undefined') {
                 renderer.canvas.style.cursor = 'move'; // Cursor over element
              } else {
                 renderer.canvas.style.cursor = 'default'; // Cursor over empty space
              }
         }
         // If currentTool is 'pen', do nothing here. Cursor remains 'crosshair'.
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