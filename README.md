# Project Summary: Cartesian Drawing Board

## Core Concept & Goal

This project aims to be an infinite canvas-based design tool specifically for rapidly prototyping and designing front-end UI elements (like buttons, headers, cards, etc.). Its unique feature is the use of an internal **Cartesian coordinate system** ((0,0) at the center, Y increases upwards) to potentially simplify geometric operations like alignment, snapping, and positioning during the design phase. The ultimate goal is to allow users to draw elements visually and then export them as functional HTML, CSS, and potentially JavaScript code snippets.

## Current State & Features

The project currently includes the following features and components:

1.  **Rendering Engine (`CartesianRenderer`):**
    *   Manages the HTML Canvas element.
    *   Handles coordinate conversions between Cartesian and Screen systems (`toScreenCoords`, `toCartesianCoords`).
    *   Maintains a list of drawable elements.
    *   Runs an animation loop (`requestAnimationFrame`) for rendering.
    *   Implements a basic dirty region system for potentially optimized redraws.
    *   Draws Cartesian axes for reference.

2.  **Element Types:**
    *   **Rectangles:** Basic colored rectangles (`addElement`).
    *   **Text:** Supports multi-line text, basic styling (font, size, color, weight, style), padding, background color, borders, and alignment (`addText`).
    *   **Images:** Loads external images, handles loading/error states with placeholders, supports opacity, and basic dimension setting (`addImage`).
    *   **Bezier Curves:** Stores path data defined by 4 points (P0, P1, P2, P3) (`addBezierCurve`).

3.  **Drawing:**
    *   Renders all implemented element types to the canvas.
    *   Draws selection handles and a border around selected 'image' elements (when selection works).
    *   Draws preview indicators (points, handles, curve) during Bezier curve creation using the Pen tool.

4.  **Interaction:**
    *   **Tool Switching:** A basic UI allows switching between a 'Select' tool and a 'Pen' tool, updating the application state and mouse cursor.
    *   **Pen Tool (Working):**
        *   Implements a **click-and-drag** workflow to define connected Bezier curve segments.
        *   The end point of one segment becomes the start point of the next (simple chaining, no automatic smoothing yet).
        *   Uses a custom SVG cursor.
        *   Provides visual previews during curve creation.
    *   **Text Editing:** Double-clicking on Text elements activates an overlay `<textarea>` for in-place editing.

## Known Issues / Bugs (Select Tool Mode)
[Please see this codepen for an exmaple of the selecting, dragging and resizing in working order](https://codepen.io/scottonanski/pen/raNqyJN)


Based on the current state in the repository (where the Pen tool is functional), the primary issues relate to the **Select Tool's** interaction logic:

1.  **Element Selection/Dragging:** Clicking on element bodies (rectangles, images, text) with the Select tool does **not** reliably select them or initiate the dragging state. The interaction often behaves as if clicking empty space.
2.  **Image Resizing:** Clicking on the corner resize handles of a selected image does **not** initiate the resizing state. The underlying element body is often selected/dragged instead, indicating the handle hit detection or the subsequent state transition in `mousedown` is failing.
3.  **Cursor State (Symptom):** While dragging sometimes initiated previously, the mouse cursor could get stuck in the 'grabbing' or 'move' state after releasing the mouse button, requiring an extra click to reset, indicating problems in the `mouseup` or `mousemove` cursor logic when the Select tool is active. *(This might be resolved by fixing selection/drag initiation)*.

## Potential Next Steps (Beyond Fixing Bugs)

*   Fix the Select tool selection, dragging, and resizing bugs.
*   Implement smooth curve connections (automatic handle reflection) for the Pen tool.
*   Add mechanisms to explicitly end a multi-segment path (e.g., Escape key).
*   Implement selection and editing (moving points) for drawn Bezier curves.
*   Add other basic shape tools (Line, Ellipse).
*   Develop the HTML/CSS/JS export functionality.
*   Implement canvas Zooming and Panning.
*   And a whole bunch of other stuff...
