// elements.js
import { validateTextOptions, wrapText, updateTextMetrics } from './utils/textUtils.js';

/**
 * Creates a rectangle element object.
 */
export function createRectElement(id, x, y, width, height, color = "red") {
    console.log(`Creating rect element ${id} at Cartesian (${x}, ${y})`);
    return { id, type: "rect", x, y, width, height, color };
}

/**
 * Creates a text element object.
 * Needs renderer's context for initial metrics calculation.
 */
export function createTextElement(renderer, id, x, y, text, options = {}) {
    const config = validateTextOptions(id, options);
    const element = { id, type: "text", x, y, text, ...config, lines: [] }; // Initialize lines

    // Perform initial text wrapping if width is constrained
    const maxWidth = config.width && config.width > 0 ? config.width : null;
    if (maxWidth) {
        element.lines = wrapText(renderer.ctx, text, maxWidth, config.fontSize, config.fontFamily, config.fontStyle, config.fontWeight);
    } else {
        element.lines = text.split('\n'); // Simple split by newline if no width constraint
    }

    // Calculate initial metrics
    updateTextMetrics(renderer.ctx, element);

    console.log(`Creating text element ${id} at Cartesian (${x}, ${y})`);
    return element;
}

/**
 * Creates an image element object and initiates loading.
 * Needs the renderer instance to mark dirty upon load/error.
 */
export function createImageElement(renderer, id, x, y, src, options = {}) {
     const defaults = { width: null, height: null, opacity: 1.0 };
     const config = { ...defaults, ...options };

    const element = {
        id, type: "image", x, y, src,
        width: config.width, // Can be null initially
        height: config.height, // Can be null initially
        opacity: Math.max(0, Math.min(1, config.opacity)), // Clamp opacity 0-1
        image: new Image(),
        loaded: false,
        error: false
    };

    element.image.onload = () => {
        element.loaded = true;
        element.error = false; // Ensure error flag is false on successful load
        const naturalWidth = element.image.naturalWidth;
        const naturalHeight = element.image.naturalHeight;

        // Calculate dimensions if not fully specified, maintaining aspect ratio
        if (element.width !== null && element.height !== null) {
            // Both dimensions provided, use them
        } else if (element.width !== null) { // Width provided, calculate height
            element.height = (element.width / naturalWidth) * naturalHeight;
        } else if (element.height !== null) { // Height provided, calculate width
            element.width = (element.height / naturalHeight) * naturalWidth;
        } else { // Neither provided, use natural size
            element.width = naturalWidth;
            element.height = naturalHeight;
        }
        console.log(`Image loaded: ${src} (ID: ${id}), size ${element.width.toFixed(0)}x${element.height.toFixed(0)}`);
        // Mark dirty *after* dimensions are set
        renderer.markDirty(element);
    };

    element.image.onerror = () => {
        element.error = true;
        element.loaded = false; // Considered not loaded if error occurred
        // Provide default dimensions if none were set, so placeholder can draw
        if (element.width === null) element.width = 50;
        if (element.height === null) element.height = 50;
        console.error(`Failed to load image: ${src} (ID: ${id}). Error handler triggered, placeholder with 'Error' text will be displayed. This is deliberate for testing purposes. It's demonstrating the error handling mechanism.`);
        renderer.markDirty(element); // Mark dirty to draw error placeholder
    };

    // Start loading the image
    element.image.src = src;

    console.log(`Creating image element ${id} at Cartesian (${x}, ${y})`);
    // Note: Element is returned immediately, loading happens async.
    // Initial draw might be a placeholder if width/height aren't provided or image loads slowly.
    return element;
}