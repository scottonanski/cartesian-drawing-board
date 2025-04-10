// drawing.js
// Corrected path for constants.js (now inside utils)
import * as Constants from './utils/constants.js';
import { toScreenCoords, toCartesianCoords } from './utils/coordinates.js';
import { updateTextMetrics } from './utils/textUtils.js';
import { getResizeHandles } from './utils/interactionUtils.js';

/** Draws a rectangle element */
export function drawRectElement(renderer, el) {
    const ctx = renderer.ctx;
    const screenCoords = toScreenCoords(el.x, el.y, renderer.originX, renderer.originY);
    // Calculate top-left corner from center coordinates
    const screenX = screenCoords.x - el.width / 2;
    const screenY = screenCoords.y - el.height / 2;

    ctx.fillStyle = el.color;
    ctx.fillRect(screenX, screenY, el.width, el.height);

    // Optional: Draw coordinates (for debugging)
    // ctx.fillStyle = "black";
    // ctx.font = "10px sans-serif";
    // ctx.textAlign = "center";
    // ctx.fillText(`(${el.x.toFixed(0)}, ${el.y.toFixed(0)})`, screenCoords.x, screenY - 5);
}

/** Draws a text element */
export function drawTextElement(renderer, el) {
    const ctx = renderer.ctx;
    // Ensure metrics are calculated
    if (typeof el.paddedWidth === 'undefined') {
        updateTextMetrics(ctx, el);
    }

    const screenCoords = toScreenCoords(el.x, el.y, renderer.originX, renderer.originY);

    ctx.save();
    ctx.font = `${el.fontStyle} ${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`;

    // Calculate bounding box based on alignment and padding
    let boxLeft, boxTop;
    const width = el.paddedWidth;
    const height = el.paddedHeight;

    switch (el.textAlign) {
        case 'left': boxLeft = screenCoords.x - el.padding; break;
        case 'center': boxLeft = screenCoords.x - width / 2; break;
        case 'right': boxLeft = screenCoords.x - el.maxWidth - el.padding; break; // Based on text width + padding
        default: boxLeft = screenCoords.x - width / 2;
    }
    switch (el.textBaseline) {
        case 'top': boxTop = screenCoords.y - el.padding; break;
        case 'middle': boxTop = screenCoords.y - height / 2; break;
        case 'bottom': boxTop = screenCoords.y - el.totalHeight - el.padding; break; // Based on text height + padding
        default: boxTop = screenCoords.y - height / 2;
    }

    // Draw background if specified
    if (el.background) {
        ctx.fillStyle = el.background;
        ctx.fillRect(boxLeft, boxTop, width, height);
    }

    // Draw border if specified
    if (el.borderWidth > 0) {
        ctx.strokeStyle = el.borderColor;
        ctx.lineWidth = el.borderWidth;
        if (el.borderStyle === 'dashed') ctx.setLineDash([5, 5]); // Example dash pattern
        else if (el.borderStyle === 'dotted') ctx.setLineDash([ctx.lineWidth, ctx.lineWidth * 1.5]); // Example dot pattern
        else ctx.setLineDash([]); // Solid line
        ctx.strokeRect(boxLeft, boxTop, width, height);
        ctx.setLineDash([]); // Reset line dash
    }

    // Draw the text lines
    ctx.fillStyle = el.color;
    ctx.textAlign = el.textAlign; // Set alignment for fillText
    ctx.textBaseline = 'top'; // Use 'top' baseline for consistent multi-line drawing start

    // Calculate starting Y position for the first line based on vertical alignment
    let startY;
    switch (el.textBaseline) {
        case 'top': startY = screenCoords.y; break; // Anchor point is top
        case 'middle': startY = screenCoords.y - el.totalHeight / 2; break; // Center the block vertically
        case 'bottom': startY = screenCoords.y - el.totalHeight; break; // Anchor point is bottom
        default: startY = screenCoords.y - el.totalHeight / 2; // Default to middle
    }

    // Apply padding adjustment relative to the calculated startY
    startY += el.padding; // Text starts inside the padding

    // Draw each line
    el.lines.forEach((line, index) => {
        // Adjust Y for each line based on font size and line height
        const lineY = startY + (index * el.fontSize * el.lineHeight);
        // X position depends on textAlign (fillText uses the alignment setting)
        ctx.fillText(line, screenCoords.x, lineY);
    });

    ctx.restore();
}

/** Draws an image element or a placeholder */
export function drawImageElement(renderer, el) {
    const ctx = renderer.ctx;

    // Ensure width/height are numbers before proceeding
     if (typeof el.width !== 'number' || typeof el.height !== 'number') {
        // If still loading/error and size isn't set, draw placeholder with default size
        if (!el.loaded || el.error) {
             drawPlaceholder(renderer, el, el.error ? "Error" : "Loading...");
        }
        // Otherwise, if loaded but size somehow invalid, maybe log an error or skip drawing
        return;
    }


    if (!el.loaded || el.error) {
        drawPlaceholder(renderer, el, el.error ? " See Console..." : "Loading...");
        return; // Don't draw image or selection if not loaded/error
    }


    const screenCoords = toScreenCoords(el.x, el.y, renderer.originX, renderer.originY);
    const screenX = screenCoords.x - el.width / 2; // Top-left X
    const screenY = screenCoords.y - el.height / 2; // Top-left Y

    // Draw the image with opacity
    const originalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = el.opacity;
    try {
        ctx.drawImage(el.image, screenX, screenY, el.width, el.height);
    } catch (e) {
        console.error(`Error drawing image ${el.id} (src: ${el.src}):`, e);
        // Optionally draw an error placeholder here instead
         drawPlaceholder(renderer, el, "Draw Error");
    }
    ctx.globalAlpha = originalAlpha; // Restore original alpha

    // Draw selection border and handles if this element is selected
    if (el === renderer.selectedElement && !renderer.editingElement) {
        drawSelectionHandles(renderer, el, screenX, screenY);
    }
}

/** Draws a placeholder for loading/error states */
export function drawPlaceholder(renderer, el, text = "") {
    const ctx = renderer.ctx;
    const screenCoords = toScreenCoords(el.x, el.y, renderer.originX, renderer.originY);

    // Use element's width/height if available, otherwise default
    const width = typeof el.width === 'number' ? el.width : 50;
    const height = typeof el.height === 'number' ? el.height : 50;
    const screenX = screenCoords.x - width / 2;
    const screenY = screenCoords.y - height / 2;

    ctx.save();
    // Background color depends on state
    ctx.fillStyle = el.error ? Constants.PLACEHOLDER_FILL_ERROR : Constants.PLACEHOLDER_FILL_LOADING;
    ctx.fillRect(screenX, screenY, width, height);

    // Draw text message if provided
    if (text) {
        ctx.fillStyle = el.error ? Constants.PLACEHOLDER_TEXT_ERROR : Constants.PLACEHOLDER_TEXT_LOADING;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Draw text at the center of the placeholder
        ctx.fillText(text, screenCoords.x, screenCoords.y);
    }
    ctx.restore();
}

/** Draws the selection border and resize handles for an element */
export function drawSelectionHandles(renderer, el, screenX, screenY) {
    const ctx = renderer.ctx;
    ctx.save();

    // Draw dashed selection border
    ctx.strokeStyle = Constants.SELECTION_COLOR;
    ctx.lineWidth = Constants.SELECTION_LINE_WIDTH;
    ctx.setLineDash(Constants.SELECTION_DASH);
    ctx.strokeRect(screenX, screenY, el.width, el.height);
    ctx.setLineDash([]); // Reset dash pattern

    // Draw resize handles
    const handles = getResizeHandles(renderer, el); // Get handle screen positions
    ctx.fillStyle = Constants.HANDLE_COLOR;
    handles.forEach(handle => {
        ctx.fillRect(
            handle.x - Constants.HANDLE_SIZE / 2,
            handle.y - Constants.HANDLE_SIZE / 2,
            Constants.HANDLE_SIZE,
            Constants.HANDLE_SIZE
        );
    });

    ctx.restore();
}

/** Draws the Cartesian axes */
export function drawAxes(renderer) {
    const ctx = renderer.ctx;
    const canvas = renderer.canvas;
    const originX = renderer.originX;
    const originY = renderer.originY;

    ctx.save();
    ctx.strokeStyle = Constants.AXIS_COLOR;
    ctx.lineWidth = 1;

    // Get screen coordinates for axes extremes (slightly off-canvas)
    const minCartX = toCartesianCoords(0, 0, originX, originY).x - 5;
    const maxCartX = toCartesianCoords(canvas.width, 0, originX, originY).x + 5;
    const minCartY = toCartesianCoords(0, canvas.height, originX, originY).y - 5;
    const maxCartY = toCartesianCoords(0, 0, originX, originY).y + 5;

    const xAxisStart = toScreenCoords(minCartX, 0, originX, originY);
    const xAxisEnd = toScreenCoords(maxCartX, 0, originX, originY);
    const yAxisStart = toScreenCoords(0, maxCartY, originX, originY);
    const yAxisEnd = toScreenCoords(0, minCartY, originX, originY);
    const originScreen = toScreenCoords(0, 0, originX, originY);

    // Draw X axis
    ctx.beginPath();
    ctx.moveTo(xAxisStart.x, xAxisStart.y);
    ctx.lineTo(xAxisEnd.x, xAxisEnd.y);
    ctx.stroke();

    // Draw Y axis
    ctx.beginPath();
    ctx.moveTo(yAxisStart.x, yAxisStart.y);
    ctx.lineTo(yAxisEnd.x, yAxisEnd.y);
    ctx.stroke();

    // Draw origin circle
    ctx.fillStyle = Constants.ORIGIN_COLOR;
    ctx.beginPath();
    ctx.arc(originScreen.x, originScreen.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Draws temporary points, handles, and curve preview during creation
/** Draws temporary points, handles, and curve preview during creation */
export function drawBezierPreview(renderer) {
    const ctx = renderer.ctx;
    const state = renderer.bezierDrawingState; // 'idle', 'definingP1', 'p1Defined', 'definingP2'
    const points = renderer.currentCurvePoints; // {p0, p1, p3}
    const style = renderer.bezierPreviewStyle;

    if (state === 'idle' || !points.p0) return; // Nothing to draw

    ctx.save();

    // --- Draw P0 ---
    const p0_screen = renderer.toScreenCoords(points.p0.x, points.p0.y);
    ctx.fillStyle = style.pointColor;
    ctx.beginPath(); ctx.arc(p0_screen.x, p0_screen.y, style.pointRadius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "black"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("P0", p0_screen.x, p0_screen.y - style.pointRadius - 2);

    let p1_screen = null;
    let p3_screen = null;
    let p2_screen_preview = null; // This will be the *reflected* point for preview

    // --- Draw P1 Handle (Dot and Line P0-P1) ---
    // Draw if P1 exists (relevant in definingP1, p1Defined, definingP2 states)
    if (points.p1 && (state === 'definingP1' || state === 'p1Defined' || state === 'definingP2')) {
        p1_screen = renderer.toScreenCoords(points.p1.x, points.p1.y);
        // Draw P1 Dot
        ctx.fillStyle = style.pointColor;
        ctx.beginPath(); ctx.arc(p1_screen.x, p1_screen.y, style.pointRadius, 0, Math.PI * 2); ctx.fill();
        ctx.fillText("P1", p1_screen.x, p1_screen.y - style.pointRadius - 2);
        // Draw P0-P1 Line
        ctx.strokeStyle = style.lineColor; ctx.lineWidth = style.lineWidth;
        ctx.beginPath(); ctx.moveTo(p0_screen.x, p0_screen.y); ctx.lineTo(p1_screen.x, p1_screen.y); ctx.stroke();
    }

    // --- Draw P3 Point and Reflected P2 Handle/Line/Curve Preview ---
    // Only draw these parts when actively defining P2
    if (state === 'definingP2') {
        // Draw P3 Dot (if P3 exists)
        if (points.p3) {
            p3_screen = renderer.toScreenCoords(points.p3.x, points.p3.y);
            ctx.fillStyle = style.pointColor;
            ctx.beginPath(); ctx.arc(p3_screen.x, p3_screen.y, style.pointRadius, 0, Math.PI * 2); ctx.fill();
            ctx.fillText("P3", p3_screen.x, p3_screen.y - style.pointRadius - 2);
        }

        // Draw P2 Handle Dot and Line P3-P2 (using live mouse pos to calculate *reflected* P2)
        if (points.p3 && renderer.currentMousePosCartesian) {
             p3_screen = p3_screen || renderer.toScreenCoords(points.p3.x, points.p3.y);
             const mousePosCartesian = renderer.currentMousePosCartesian;

             // Calculate the REFLECTED P2 position based on current mouse drag
             const reflectedP2_cartesian = {
                 x: points.p3.x + (points.p3.x - mousePosCartesian.x),
                 y: points.p3.y + (points.p3.y - mousePosCartesian.y)
             };
             p2_screen_preview = renderer.toScreenCoords(reflectedP2_cartesian.x, reflectedP2_cartesian.y);

            // Draw P2 Dot (at the calculated reflected position)
            ctx.fillStyle = style.pointColor;
            ctx.beginPath(); ctx.arc(p2_screen_preview.x, p2_screen_preview.y, style.pointRadius, 0, Math.PI * 2); ctx.fill();
            ctx.fillText("P2", p2_screen_preview.x, p2_screen_preview.y - style.pointRadius - 2);

            // Draw Line from P3 to the calculated P2 preview position
            ctx.strokeStyle = style.lineColor; ctx.lineWidth = style.lineWidth;
            ctx.beginPath(); ctx.moveTo(p3_screen.x, p3_screen.y); ctx.lineTo(p2_screen_preview.x, p2_screen_preview.y); ctx.stroke();

            // Optional: Draw the handle/dot the user is actually dragging (maybe dashed line to it?)
            const mousePosScreen = renderer.toScreenCoords(mousePosCartesian.x, mousePosCartesian.y);
            ctx.fillStyle = 'rgba(200, 200, 200, 0.6)'; // Lighter color for actual drag handle
            ctx.beginPath(); ctx.arc(mousePosScreen.x, mousePosScreen.y, style.pointRadius - 1, 0, Math.PI * 2); ctx.fill();
            // Draw dashed line from P3 to actual mouse drag position
            ctx.save(); // Save before setting dash
            ctx.setLineDash([2, 3]);
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
            ctx.beginPath(); ctx.moveTo(p3_screen.x, p3_screen.y); ctx.lineTo(mousePosScreen.x, mousePosScreen.y); ctx.stroke();
            ctx.restore(); // Restore (removes dash setting)

        }

        // --- Draw Live Curve Preview ---
        // Draw using P0, P1, P3 and the calculated REFLECTED P2 for preview
        if (p0_screen && p1_screen && p3_screen && p2_screen_preview) {
            ctx.strokeStyle = renderer.bezierCurveStyle.color;
            ctx.lineWidth = renderer.bezierCurveStyle.lineWidth;
            // Optional: Dashed line for preview
            // ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(p0_screen.x, p0_screen.y);
            ctx.bezierCurveTo(p1_screen.x, p1_screen.y, p2_screen_preview.x, p2_screen_preview.y, p3_screen.x, p3_screen.y);
            ctx.stroke();
            // ctx.setLineDash([]); // Reset dash
        }
    }

    ctx.restore();
}

// Draws a finished Bezier curve element
export function drawBezierElement(renderer, el) {
    const ctx = renderer.ctx;

    // Make sure we have the right element type and the points array
    if (el.type !== 'bezier' || !Array.isArray(el.points) || el.points.length !== 4) {
        console.warn(`Attempted to draw invalid bezier element: ID ${el.id}`);
        return;
    }

    // Convert the stored Cartesian points [P0, P1, P2, P3] to screen coordinates
    const screenPoints = el.points.map(pt => renderer.toScreenCoords(pt.x, pt.y));
    const p0 = screenPoints[0]; // Start Point
    const p1 = screenPoints[1]; // Control Point 1
    const p2 = screenPoints[2]; // Control Point 2
    const p3 = screenPoints[3]; // End Point

    ctx.save(); // Save current styles
    ctx.strokeStyle = el.color || 'black';     // Use element's color or default to black
    ctx.lineWidth = el.lineWidth || 1;         // Use element's line width or default to 2
    ctx.beginPath();                           // Start a new path
    ctx.moveTo(p0.x, p0.y);                    // Move to the starting point (P0)
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y); // Draw the curve using P1, P2, P3
    ctx.stroke();                              // Render the path outline
    ctx.restore(); // Restore previous styles
}