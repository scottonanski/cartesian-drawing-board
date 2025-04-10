// Renderer.js
import * as Constants from './utils/constants.js';
import { toScreenCoords, toCartesianCoords } from './utils/coordinates.js';
import * as Drawing from './drawing.js';
import * as EventHandlers from './eventHandlers.js';
import * as DirtyRegions from './dirtyRegions.js';
import * as Elements from './elements.js';
import { getElementScreenBounds } from './utils/interactionUtils.js';
// Note: Editing/InteractionUtils are used indirectly via EventHandlers/DirtyRegions/Drawing
// Editing functions are used within event handlers, no direct import needed here usually
// Interaction utils are used within event handlers/dirty regions

// Define the path to your cursor - relative from index.html
const PEN_CURSOR_URL = './src/assets/svg/pen-tool-tip.svg';
// Define hotspot (adjust x,y as needed for your SVG's tip) - might need experimentation
const PEN_CURSOR_HOTSPOT_X = 0;
const PEN_CURSOR_HOTSPOT_Y = 10; // Example: 10 pixels down from top-left

export class CartesianRenderer {


    constructor(canvasId) {

        // --- Get Canvas and Context ---
        this.canvas = document.getElementById(canvasId);

        if (!this.canvas) { 
            console.error(`Canvas element with ID "${canvasId}" not found.`); 
            return; 
        } 

        this.ctx = this.canvas.getContext("2d"); 

        if (!this.ctx) { 
             console.error(`Failed to get 2D context for canvas "${canvasId}".`);
             return; 
        }

        // --- Initial State Properties ---

        // Tool State
        this.currentTool = 'select';

        // Core State
        this.elements = [];
        this.nextElementId = 0;
        this.originX = 0;
        this.originY = 0;

        // Interaction State
        this.dragging = false;
        this.resizing = false;
        this.selectedElement = null;
        this.editingElement = null;

        // Drag/Resize Internals
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.resizeHandleType = null;
        this.originalDimensions = null;
        this.startMousePos = null;

        // Rendering Optimization State
        this.dirtyRegions = [];
        this.fullRedraw = true;

        // Add the new state variables for click-and-drag:
        
        // 'idle', 'definingP1', 'awaitingP3', 'definingP2'
        this.bezierDrawingState = 'idle';
        
        // Store points for the curve being built
        this.currentCurvePoints = {
            p0: null, // Start point (Cartesian)
            p1: null, // Control point 1 (Cartesian)
            p3: null  // End point (Cartesian)
        };

        // Stores live {x, y} during relevant drags (needed for preview)
        this.currentMousePosCartesian = null;

        // Keep/Update the style objects:
        this.bezierPreviewStyle = {
            pointRadius: 4,
            pointColor: 'rgba(0, 100, 255, 0.7)',
            lineColor: 'rgba(0, 100, 255, 0.3)',
            lineWidth: 1
        };

        this.bezierCurveStyle = {
            color: 'rgb(177, 177, 177)', 
            lineWidth: 1                 
        };

        // --- Bind methods & Utilities ---
        this.animate = this.animate.bind(this); 
        this.toScreenCoords = (x, y) => toScreenCoords(x, y, this.originX, this.originY); 
        this.toCartesianCoords = (x, y) => toCartesianCoords(x, y, this.originX, this.originY); 
        this.markDirty = (element) => DirtyRegions.markDirty(this, element); 
        this.markEntireCanvasDirty = () => DirtyRegions.markEntireCanvasDirty(this); 
        // --- End of Binds & Utilities

        // --- Initial Setup ---
        this.setupCanvas(); 
        this.addEventListeners(); 
        this.start(); 
        // --- End of Initial Setup ---

    } // End of constructor


    // --- Tool Management ---
    // --- Tool Management ---
    setTool(toolName) {
        // Log the tool change for debugging
        console.log("Changing tool to:", toolName);
        // Store the new tool name
        this.currentTool = toolName;

        // Reset the drawing state variables whenever the tool changes
        this.bezierDrawingState = 'idle';
        this.currentCurvePoints = { p0: null, p1: null, p3: null };
        // Reset the temporary mouse position tracker
        this.currentMousePosCartesian = null;

        // Define the path to the cursor file in the 'public' directory
        const PEN_CURSOR_PATH = '/pen-tool-tip.svg'; // Or '/pen-tool-tip.svg' if you prefer

        // Set the cursor based on the selected tool
        if (toolName === 'pen') {
            // Use the SVG cursor with hotspot for the pen tool
            this.canvas.style.cursor = `url(${PEN_CURSOR_PATH}) 3 18, crosshair`; // Adjust hotspot (3 18) if needed
        } else {
            // Use the default arrow cursor for the 'select' tool
            this.canvas.style.cursor = 'default';
            // Optional: Also deselect any selected element when switching away from pen
            this.selectedElement = null;
        }
        // Mark the canvas dirty to clear any lingering previews from the previous tool
        this.markEntireCanvasDirty();
    }
    /** Sets initial canvas size and calculates origin */
    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.originX = this.canvas.width / 2;
        this.originY = this.canvas.height / 2;
         console.log(`Canvas setup: ${this.canvas.width}x${this.canvas.height}, Origin: (${this.originX}, ${this.originY})`);
         this.markEntireCanvasDirty(); // Ensure redraw after setup
    }

    /** Attaches event listeners */
    addEventListeners() {
        // Use factory functions to create handlers that close over `this` (the renderer instance)
        this.mouseDownHandler = EventHandlers.createMouseDownHandler(this);
        this.mouseMoveHandler = EventHandlers.createMouseMoveHandler(this);
        this.mouseUpHandler = EventHandlers.createMouseUpHandler(this);
        this.mouseLeaveHandler = EventHandlers.createMouseLeaveHandler(this);
        this.doubleClickHandler = EventHandlers.createDoubleClickHandler(this);
        this.resizeHandler = EventHandlers.createResizeHandler(this);

        window.addEventListener('resize', this.resizeHandler);
        this.canvas.addEventListener('mousedown', this.mouseDownHandler);
        this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
        // Use window for mouseup/mouseleave to catch events outside canvas during drag/resize
        window.addEventListener('mouseup', this.mouseUpHandler);
        window.addEventListener('mouseleave', this.mouseLeaveHandler); // Handle mouse leaving window entirely
        // this.canvas.addEventListener('mouseleave', this.mouseLeaveHandler); // Alternative: handle leaving just canvas
        this.canvas.addEventListener('dblclick', this.doubleClickHandler);

         // Prevent default browser drag behavior on the canvas (e.g., image ghosting)
         this.canvas.addEventListener('dragstart', (e) => e.preventDefault());
    }

    /** Removes event listeners */
    removeEventListeners() {
         window.removeEventListener('resize', this.resizeHandler);
         this.canvas.removeEventListener('mousedown', this.mouseDownHandler);
         this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
         window.removeEventListener('mouseup', this.mouseUpHandler);
         window.removeEventListener('mouseleave', this.mouseLeaveHandler);
         // this.canvas.removeEventListener('mouseleave', this.mouseLeaveHandler);
         this.canvas.removeEventListener('dblclick', this.doubleClickHandler);
         this.canvas.removeEventListener('dragstart', (e) => e.preventDefault());
         console.log("Removed event listeners.");
    }

    /* --- Element Factory Methods 
    These methods use the functions from elements.js */

    addElement(x, y, width, height, color = "red") {
        const id = this.nextElementId++;
        const element = Elements.createRectElement(id, x, y, width, height, color);
        this.elements.push(element);
        this.markDirty(element); // Mark the new element's area dirty
        return element;
    }

    addText(x, y, text, options = {}) {
        const id = this.nextElementId++;
        // Pass `this` (renderer instance) because createTextElement needs context for metrics
        const element = Elements.createTextElement(this, id, x, y, text, options);
        this.elements.push(element);
        this.markDirty(element);
        return element;
    }

    addImage(x, y, src, options = {}) {
        const id = this.nextElementId++;
        // Pass `this` because createImageElement needs it for async marking dirty
        const element = Elements.createImageElement(this, id, x, y, src, options);
        this.elements.push(element);
        // Mark dirty initially for placeholder (if dimensions known) or loading state
        // The image onload/onerror will mark dirty again with final dimensions/state
        this.markDirty(element);
        return element;
    }

    // --- Core Drawing Logic ---   
    draw() {
        const ctx = this.ctx;
        // Do nothing if the canvas context isn't available
        if (!ctx) return;

        // --- Handle Full Redraw ---
        if (this.fullRedraw) {
            // Clear the entire canvas
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            // Draw the background axes
            Drawing.drawAxes(this);
            // Draw every element (except the one being edited)
            this.elements.forEach(el => {
                if (el !== this.editingElement) {
                    this.drawElementByType(el);
                }
            });
            // Call the preview drawing function if we are in a drawing state
            // and have at least the starting point defined.
            if (this.bezierDrawingState !== 'idle' && this.currentCurvePoints.p0) {
                Drawing.drawBezierPreview(this);
            }
        }
        // --- Handle Partial Redraw (Dirty Regions) ---
        else if (this.dirtyRegions.length > 0) {
            // Merge overlapping dirty areas for efficiency
            const merged = DirtyRegions.mergeRegions(this.dirtyRegions);

            // Save context state before clearing/drawing
            ctx.save();

            // Clear only the merged dirty rectangles
            merged.forEach(region => {
                // Use floor/ceil for pixel precision and add a small buffer
                const x = Math.floor(region.x);
                const y = Math.floor(region.y);
                const w = Math.ceil(region.width) + 1;
                const h = Math.ceil(region.height) + 1;
                ctx.clearRect(x, y, w, h);
            });

            // Redraw axes (simplest approach, could be optimized later)
            Drawing.drawAxes(this);

            // Redraw elements that intersect with any dirty region
            this.elements.forEach(el => {
                if (el === this.editingElement) return; // Skip edited element
                // Get element bounds (ensure getElementScreenBounds is imported/available)
                const bounds = getElementScreenBounds(this, el);
                if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

                let needsRedraw = false;
                // Check overlap with each merged dirty region
                for (const region of merged) {
                    if (DirtyRegions.regionsOverlap(bounds, region)) {
                        needsRedraw = true;
                        break; // Found an overlap, no need to check further
                    }
                }
                // If overlap found, redraw the element
                if (needsRedraw) {
                    this.drawElementByType(el);
                }
            });

            // Also call preview drawing here if needed, after elements are drawn
            if (this.bezierDrawingState !== 'idle' && this.currentCurvePoints.p0) {
                Drawing.drawBezierPreview(this);
            }

            // Restore context state
            ctx.restore();
        }
        // If no dirty regions and not a full redraw, do nothing for elements.
        // But we might still need to draw/update the preview if it exists?
        // The current logic relies on markEntireCanvasDirty() during preview updates,
        // so this else block might not be strictly needed for the preview.

        // Reset flags for the next animation frame
        this.fullRedraw = false;
        this.dirtyRegions = [];
    }

    /** Helper to call the correct drawing function based on element type */
    drawElementByType(el) {
        switch (el.type) {
            case "rect":
                Drawing.drawRectElement(this, el);
                break;
            case "text":
                 // Ensure metrics are calculated before drawing (drawing func also does this, but good practice)
                 if (typeof el.paddedWidth === 'undefined') {
                    el.updateTextMetrics(this.ctx, el); // Assumes updateTextMetrics is available if needed standalone
                 }
                Drawing.drawTextElement(this, el);
                break;
            case "bezier":
                Drawing.drawBezierElement(this, el);
                break;

            case "image":
                Drawing.drawImageElement(this, el);
                break;
            default:
                console.warn(`Unknown element type encountered during drawing: ${el.type}`);
        }
    }

    // --- Animation Loop ---

    /** The main animation loop */
    animate() {
        this.draw(); // Perform drawing based on dirty regions or full redraw flag
        // Request the next frame
        this.animationFrameId = requestAnimationFrame(this.animate);
    }

    /** Starts the rendering loop */
    start() {
        if (!this.ctx) return; // Don't start if context failed
        if (this.animationFrameId) {
             console.warn("Renderer already started.");
             return;
        }
        console.log("Cartesian Renderer Started");
        this.fullRedraw = true; // Ensure first frame is a full draw
        this.animate();
    }

    /** Stops the rendering loop */
     stop() {
         if (this.animationFrameId) {
             cancelAnimationFrame(this.animationFrameId);
             this.animationFrameId = null;
             console.log("Cartesian Renderer Stopped");
         }
         // Clean up event listeners when stopping permanently
         this.removeEventListeners();
          // Remove editing overlay if active
         if (this.editingElement) {
             const overlay = document.querySelector('.edit-overlay');
             if (overlay) overlay.remove();
             this.editingElement = null;
         }
     }

    // --- Element Factory Methods ---
    // ... (keep addElement, addText, addImage) ...

    // Replace the old addBezierCurve with this version
    addBezierCurve(p0, p1, p2, p3) {
        // Validate that all four point arguments were actually provided
        if (!p0 || !p1 || !p2 || !p3) {
            // Log an error if any point is missing
            console.error("Attempted to add Bezier curve with missing points.");
            // Return null to indicate that element creation failed
            return null;
        }

        // Get the next available element ID
        const id = this.nextElementId++;

        // Create the 'bezier' element object.
        // The points are passed in the correct P0, P1, P2, P3 order.
        const element = {
            id,
            type: "bezier",
            // Store the array of point objects
            points: [p0, p1, p2, p3],
            // Use the currently defined style for new curves
            color: this.bezierCurveStyle.color,
            lineWidth: this.bezierCurveStyle.lineWidth
        };

        // Add the newly created element to the renderer's list
        this.elements.push(element);
        // Log confirmation to the console
        console.log(`Added bezier element ${id}`);

        // Mark the canvas dirty so the new curve gets drawn
        // This also helps clear any final preview state
        this.markEntireCanvasDirty();
        // Return the newly created element object
        return element;
    }
}