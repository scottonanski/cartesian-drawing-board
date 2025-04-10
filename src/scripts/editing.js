// editing.js
import { updateTextMetrics, wrapText } from './utils/textUtils.js';
import { markDirty } from './dirtyRegions.js';
import { toScreenCoords } from './utils/coordinates.js';

let editBlurTimeout = null; // Module-level variable to manage blur timeout

/** Starts the text editing process for an element */
export function startEditing(renderer, element) {
    if (renderer.editingElement) {
        stopEditing(renderer); // Stop previous edit if any
    }
    renderer.editingElement = element;
    console.log(`Started editing text element ID ${element.id}`);

    // Deselect any other element and stop dragging/resizing
    renderer.selectedElement = null;
    renderer.dragging = false;
    renderer.resizing = false;
    renderer.canvas.style.cursor = 'text'; // Indicate text editing mode

    // Create and configure the textarea overlay
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-overlay';
    textarea.value = element.text; // Use raw text for editing
    textarea.setAttribute('data-element-id', element.id);
    document.body.appendChild(textarea);

    // Position and style the textarea
    updateEditOverlay(renderer, textarea, element);
    textarea.focus();
    textarea.select(); // Select text for easy replacement

    // Store handlers directly on the element to remove them later
    textarea._blurHandler = createEditBlurHandler(renderer, textarea);
    textarea._keydownHandler = createEditKeydownHandler(renderer, textarea);
    textarea._inputHandler = createEditInputHandler(renderer, textarea); // Add input handler for live resize

    textarea.addEventListener('blur', textarea._blurHandler);
    textarea.addEventListener('keydown', textarea._keydownHandler);
    textarea.addEventListener('input', textarea._inputHandler);

    // Mark the area dirty initially to clear the original text render
    markDirty(renderer, element);
}

/** Updates the position and style of the edit overlay */
export function updateEditOverlay(renderer, textarea = null, element = null) {
    textarea = textarea || document.querySelector('.edit-overlay');
    element = element || renderer.editingElement;

    if (!textarea || !element) return;

    // Ensure metrics are current
    if (typeof element.paddedWidth === 'undefined') {
        updateTextMetrics(renderer.ctx, element);
    }

    const screenPos = toScreenCoords(element.x, element.y, renderer.originX, renderer.originY);
    let left, top, width, height;

    // Use the *padded* dimensions for the overlay size
    width = element.paddedWidth;
    height = element.paddedHeight;

     // Calculate top-left based on alignment (consistent with drawing logic)
    switch (element.textAlign) {
        case 'left': left = screenPos.x - element.padding; break;
        case 'center': left = screenPos.x - width / 2; break;
        case 'right': left = screenPos.x - element.maxWidth - element.padding; break;
        default: left = screenPos.x - width / 2;
    }
    switch (element.textBaseline) {
        case 'top': top = screenPos.y - element.padding; break;
        case 'middle': top = screenPos.y - height / 2; break;
        case 'bottom': top = screenPos.y - element.totalHeight - element.padding; break;
        default: top = screenPos.y - height / 2;
    }

    // Apply styles matching the text element
    textarea.style.position = 'absolute'; // Crucial for positioning
    textarea.style.left = `${left}px`;
    textarea.style.top = `${top}px`;
    textarea.style.width = `${width}px`;
    textarea.style.height = `${height}px`;
    textarea.style.padding = `${element.padding}px`; // Internal padding for text
    textarea.style.boxSizing = 'border-box'; // Padding included in width/height
    textarea.style.font = `${element.fontStyle} ${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`;
    textarea.style.lineHeight = `${element.lineHeight}`; // Ensure line height matches
    textarea.style.color = element.color;
    textarea.style.textAlign = element.textAlign;
    textarea.style.border = `${element.borderWidth}px ${element.borderStyle} ${element.borderColor}`; // Match border
    textarea.style.background = element.background || 'white'; // Ensure visibility
    textarea.style.zIndex = '1000'; // Ensure overlay is on top
    textarea.style.overflow = 'hidden'; // Hide scrollbars initially
    textarea.style.resize = 'none'; // Disable manual resize handle
}

/** Stops the text editing process */
export function stopEditing(renderer, cancel = false) {
    if (!renderer.editingElement) return;

    const element = renderer.editingElement;
    const textarea = document.querySelector(`.edit-overlay[data-element-id="${element.id}"]`);

    if (!textarea) {
        console.warn(`Textarea for element ${element.id} not found during stopEditing.`);
        renderer.editingElement = null; // Clear editing state anyway
        return;
    }

    clearTimeout(editBlurTimeout); // Prevent blur handler from firing after explicit stop

    if (!cancel) {
        const newText = textarea.value;
        if (newText !== element.text) {
            element.text = newText;
            // Re-wrap text and update metrics based on the element's potential fixed width
             const maxWidth = element.width && element.width > 0 ? element.width : null;
             if (maxWidth) {
                 element.lines = wrapText(renderer.ctx, newText, maxWidth, element.fontSize, element.fontFamily, element.fontStyle, element.fontWeight);
             } else {
                 element.lines = newText.split('\n'); // Simple split if no fixed width
             }
            updateTextMetrics(renderer.ctx, element); // Recalculate bounds based on new text/lines
            console.log(`Updated text element ID ${element.id}`);
             markDirty(renderer, element); // Mark updated area dirty
        }
    } else {
        console.log(`Cancelled editing for text element ID ${element.id}`);
        // No changes made, but still need to redraw the original text
         markDirty(renderer, element);
    }

    // Cleanup: remove listeners and the textarea element
    textarea.removeEventListener('blur', textarea._blurHandler);
    textarea.removeEventListener('keydown', textarea._keydownHandler);
    textarea.removeEventListener('input', textarea._inputHandler);
    if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
    }

    // Reset state
    renderer.editingElement = null;
    // Re-select the element after editing (optional, but good UX)
    renderer.selectedElement = element;
    renderer.canvas.style.cursor = 'move'; // Or default if element isn't selectable/movable

     // Mark dirty again *after* removal to ensure clean redraw
     markDirty(renderer, element);
}


// --- Internal Helper Functions for Event Handlers ---

function createEditBlurHandler(renderer, textarea) {
    return function handleEditBlur() {
        // Use a small timeout to allow clicks on other controls/canvas without immediately stopping edit
        editBlurTimeout = setTimeout(() => {
            // Check if the textarea still exists and is the active element
            // If focus moved elsewhere (and not back to the textarea quickly), stop editing.
            if (renderer.editingElement && document.activeElement !== textarea) {
                 console.log("Blur detected, stopping edit");
                 stopEditing(renderer);
            }
        }, 150); // Increased timeout slightly
    };
}

function createEditKeydownHandler(renderer, textarea) {
    return function handleEditKeyDown(event) {
        clearTimeout(editBlurTimeout); // Clear blur timeout on any key activity

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent newline in textarea
            stopEditing(renderer); // Commit changes
        } else if (event.key === 'Escape') {
            stopEditing(renderer, true); // Cancel changes
        }
        // Allow Tab key to potentially move focus (default behavior)
        // Allow Shift+Enter for newlines (default behavior)
    };
}

function createEditInputHandler(renderer, textarea) {
     // Optional: Handle input events for live resizing or updates if needed
     // For now, it primarily clears the blur timeout
    return function handleEditInput() {
        clearTimeout(editBlurTimeout);
        // Example: Resize textarea height dynamically (simple version)
        // textarea.style.height = 'auto'; // Reset height
        // textarea.style.height = `${textarea.scrollHeight}px`;
        // Note: Dynamic resizing based on content needs careful implementation
        // to match the canvas text rendering (line wrapping, etc.)
        // For now, we rely on the initial size based on text metrics.
    }
}