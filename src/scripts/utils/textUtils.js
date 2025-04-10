// utils/textUtils.js

/**
 * Wraps text to fit within a specified width.
 * Needs canvas context for text measurement.
 */
export function wrapText(ctx, text, maxWidthCartesian, fontSize, fontFamily, fontStyle, fontWeight) {
    ctx.save();
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    const maxWidth = maxWidthCartesian; // Assuming maxWidth is already in screen pixels/units if needed
    const lines = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let currentLine = [];
        for (const word of words) {
            const testLine = [...currentLine, word].join(' ');
            if (ctx.measureText(testLine).width <= maxWidth || currentLine.length === 0) {
                currentLine.push(word);
            } else {
                // Push the line *before* adding the word that didn't fit
                if (currentLine.length > 0) {
                     lines.push(currentLine.join(' '));
                }
                // Start new line with the word
                currentLine = [word];
                // Handle single word too long for a line
                if (ctx.measureText(word).width > maxWidth) {
                    lines.push(word); // Add the long word as its own line
                    currentLine = []; // Reset for next word
                }
            }
        }
        // Push any remaining words in currentLine
        if (currentLine.length > 0) lines.push(currentLine.join(' '));
        // Handle empty paragraphs (preserve line breaks)
        if (paragraph === '' && (lines.length === 0 || lines[lines.length - 1] !== '')) {
             lines.push('');
        }
    }
    ctx.restore();
    return lines.length > 0 ? lines : ['']; // Ensure at least one line if text is empty
}

/**
 * Updates the calculated metrics (width, height, padding) for a text element.
 * Needs canvas context for text measurement.
 */
export function updateTextMetrics(ctx, el) {
    ctx.save();
    ctx.font = `${el.fontStyle} ${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`;
    el.lines = Array.isArray(el.lines) ? el.lines : ['']; // Ensure lines is an array
    // Calculate max width based on current lines
    el.maxWidth = el.lines.length > 0 ? Math.max(...el.lines.map(line => ctx.measureText(line).width)) : 0;
    // Calculate total height based on lines, font size, and line height
    el.totalHeight = el.lines.length * el.fontSize * el.lineHeight;
    // Adjust height calculation for multi-line text if needed (based on original logic)
    // if (el.lines.length > 1) el.totalHeight -= el.fontSize * el.lineHeight * (1.0 - 0.8); // Re-evaluate if this adjustment is correct
    el.paddedWidth = el.maxWidth + el.padding * 2;
    el.paddedHeight = el.totalHeight + el.padding * 2;
    ctx.restore();
}

/**
 * Validates text options and applies defaults.
 */
export function validateTextOptions(id, options) {
    const defaults = {
        color: "black", fontSize: 16, fontFamily: "sans-serif",
        fontWeight: "normal", fontStyle: "normal",
        textAlign: "center", textBaseline: "middle",
        lineHeight: 1.2, padding: 0, background: null, width: null, // Cartesian width for wrapping
        borderColor: "black", borderWidth: 0, borderStyle: "solid"
    };
    const config = { ...defaults, ...options };

    // Validation logic (optional but good practice)
    const validWeights = ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
    const validStyles = ['normal', 'italic', 'oblique'];
    const validBorderStyles = ['solid', 'dashed', 'dotted'];
    if (!validWeights.includes(config.fontWeight)) { console.warn(`Invalid fontWeight '${config.fontWeight}' for element ${id}; defaulting to 'normal'`); config.fontWeight = 'normal'; }
    if (!validStyles.includes(config.fontStyle)) { console.warn(`Invalid fontStyle '${config.fontStyle}' for element ${id}; defaulting to 'normal'`); config.fontStyle = 'normal'; }
    if (!validBorderStyles.includes(config.borderStyle)) { console.warn(`Invalid borderStyle '${config.borderStyle}' for element ${id}; defaulting to 'solid'`); config.borderStyle = 'solid'; }
    config.borderWidth = Math.max(0, config.borderWidth);

    return config;
}