// Renderer.js
import * as Constants from './constants.js';
import { toScreenCoords, toCartesianCoords } from './utils/coordinates.js';
import * as Drawing from './drawing.js';
import * as EventHandlers from './eventHandlers.js';
import * as DirtyRegions from './dirtyRegions.js';
import * as Elements from './elements.js';
// Editing functions are used within event handlers, no direct import needed here usually
// Interaction utils are used within event handlers/dirty regions

export class CartesianRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas element with ID "${canvasId}" not found.`);
            return; // Cannot proceed
        }
        this.ctx = this.canvas.getContext("2d");
        if (!this.ctx) {
             console.error(`Failed to get 2D context for canvas "${canvasId}".`);
             return;
        }

        // Core State
        this.elements = [];
        this.nextElementId = 0;
        this.originX = 0;
        this.originY = 0;

        // Interaction State
        this.dragging = false;
        this.resizing = false;
        this.selectedElement = null;
        this.editingElement = null; // Element currently being edited (text)

        // Drag/Resize Internals
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.resizeHandleType = null;
        this.originalDimensions = null; // Store original {x, y, width, height} during resize
        this.startMousePos = null; // Store {x, y} of mouse down during resize

        // Rendering Optimization State
        this.dirtyRegions = [];
        this.fullRedraw = true; // Start with a full redraw

        // Bind methods that will be used as event handlers or need `this` preserved
        // Note: Event handlers are now created by factories in eventHandlers.js
        this.animate = this.animate.bind(this);
        // Make utility functions available on the instance for convenience in other modules
        this.toScreenCoords = (x, y) => toScreenCoords(x, y, this.originX, this.originY);
        this.toCartesianCoords = (x, y) => toCartesianCoords(x, y, this.originX, this.originY);
        this.markDirty = (element) => DirtyRegions.markDirty(this, element);
        this.markEntireCanvasDirty = () => DirtyRegions.markEntireCanvasDirty(this);

        // Setup
        this.setupCanvas();
        this.addEventListeners();
        this.start();
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

    // --- Element Factory Methods ---
    // These methods use the factory functions from elements.js

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

    /** Main drawing routine, handles full or partial redraws */
    draw() {
        const ctx = this.ctx;
        if (!ctx) return;

        if (this.fullRedraw) {
            // console.log("Performing full redraw.");
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            Drawing.drawAxes(this); // Pass renderer instance
            this.elements.forEach(el => {
                 // Don't draw the text element itself while its overlay is active
                if (el !== this.editingElement) {
                    this.drawElementByType(el);
                }
            });
        } else if (this.dirtyRegions.length > 0) {
            const merged = DirtyRegions.mergeRegions(this.dirtyRegions);
            // console.log(`Redrawing ${merged.length} merged dirty region(s).`);

            ctx.save(); // Save context state before potentially clipping or complex drawing

            // 1. Clear all merged dirty rectangles
            merged.forEach(region => {
                // Use Math.ceil/floor for pixel snapping, add buffer just in case
                const x = Math.floor(region.x);
                const y = Math.floor(region.y);
                const w = Math.ceil(region.width) + 1;
                const h = Math.ceil(region.height) + 1;
                ctx.clearRect(x, y, w, h);
            });

            // 2. Redraw axes (could be optimized to only redraw if they intersect dirty regions)
             Drawing.drawAxes(this);

            // 3. Redraw elements that intersect with *any* of the dirty regions
            this.elements.forEach(el => {
                if (el === this.editingElement) return; // Skip element being edited

                const bounds = DirtyRegions.getElementScreenBounds(this, el);
                 if (!bounds || bounds.width <= 0 || bounds.height <= 0) return; // Skip if no valid bounds

                let needsRedraw = false;
                for (const region of merged) {
                    // Check if element's bounding box overlaps with the dirty region
                    if (DirtyRegions.regionsOverlap(bounds, region)) {
                        needsRedraw = true;
                        break; // No need to check other regions for this element
                    }
                }

                if (needsRedraw) {
                    this.drawElementByType(el);
                }
            });

            ctx.restore(); // Restore context state
        }

        // Reset flags/regions for the next frame
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
}