// src/scripts/main.js
import { CartesianRenderer } from './Renderer.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded, initializing renderer...");
    const engine = new CartesianRenderer("myCartesianCanvas");

    if (!engine || !engine.ctx) {
        console.error("Renderer initialization failed.");
        return;
    }

    // --- Add initial elements (as before) ---
    engine.addText(-200, 150, "Editable Text\n(Double-click Me!)", { /* ... options ... */ });
    engine.addImage(150, 100, "https://picsum.photos/seed/image1/300/200", { width: 120 });
    engine.addImage(-100, -150, "https://picsum.photos/seed/image2/150/150", { opacity: 0.8 });
    engine.addImage(200, -50, "https://picsum.photos/seed/image3/100/200", { width: 50, height: 100 });
    engine.addElement(0, 0, 40, 40, "purple");
    engine.addText(0, -200, "This is a longer text string that should wrap automatically because a width is specified.", { /* ... options ... */ });
    // Use a valid image or remove the intentionally failing one
    // engine.addImage(-250, -50, "https://example.com/nonexistent_image.jpg", { width: 100 });
    engine.addImage(-250, -50, "https://picsum.photos/seed/validreplace/200/150", { width: 100 });


    console.log("Demo Loaded. Use toolbar to switch between Select and Bezier Tool.");

    // --- Add Tool Button Listeners ---
    const selectToolBtn = document.getElementById('selectToolBtn');
    const bezierToolBtn = document.getElementById('bezierToolBtn');

    if (selectToolBtn && bezierToolBtn && engine.setTool) { // Check if setTool exists
        selectToolBtn.addEventListener('click', () => {
            engine.setTool('select');
            selectToolBtn.classList.add('active');
            bezierToolBtn.classList.remove('active');
        });

        bezierToolBtn.addEventListener('click', () => {
            engine.setTool('pen');
            bezierToolBtn.classList.add('active');
            selectToolBtn.classList.remove('active');
        });
    } else {
        console.error("Toolbar buttons or engine.setTool method not found!");
    }

    // Optional: Make engine accessible globally for debugging
    // window.cartesianEngine = engine;
});