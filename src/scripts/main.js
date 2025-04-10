// main.js
import { CartesianRenderer } from './Renderer.js'; // Note the .js extension might be needed by some servers/tools

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded, initializing renderer...");
    const engine = new CartesianRenderer("myCartesianCanvas");

    // Check if engine initialized correctly (canvas/context found)
    if (!engine || !engine.ctx) {
        console.error("Renderer initialization failed.");
        // Optionally display an error message to the user on the page
        const canvasElement = document.getElementById("myCartesianCanvas");
        if(canvasElement) {
            canvasElement.style.border = "2px solid red";
            // You could add a text node or overlay indicating the error
        }
        return;
    }

    // Add elements using the engine's methods
    engine.addText(-200, 150, "Editable Text\n(Double-click Me!)", {
        textAlign: "left",
        textBaseline: "top",
        fontSize: 16,
        padding: 8,
        background: "lightblue",
        borderWidth: 2,
        borderColor: "darkblue",
        fontFamily: "Arial"
    });

    engine.addImage(150, 100, "https://picsum.photos/seed/image1/300/200", {
        width: 120 // Specify initial width, height will be calculated maintaining aspect ratio
    });

     engine.addImage(-100, -150, "https://picsum.photos/seed/image2/150/150", {
         // No dimensions specified, will use natural image size
         opacity: 0.8
     });

     engine.addImage(200, -50, "https://picsum.photos/seed/image3/100/200", {
         width: 50,
         height: 100 // Specify both width and height, aspect ratio might be ignored
     });

     // Example of a rectangle
     engine.addElement(0, 0, 40, 40, "purple");

     // Example of text with fixed width wrapping
      engine.addText(0, -200, "This is a longer text string that should wrap automatically because a width is specified.", {
          width: 150, // Cartesian width for wrapping calculation
          fontSize: 14,
          background: 'lightyellow',
          padding: 5,
          borderWidth: 1,
          borderColor: 'orange',
          textAlign: 'left'
      });

     // Example of an image that might fail to load
     engine.addImage(-250, -50, "https://example.com/nonexistent_image.jpg", { width: 100 });


    console.log("Demo Loaded. Click images to select, drag corners to resize (hold Shift for aspect ratio). Double-click text to edit.");

    // Optional: Make engine accessible globally for debugging
    // window.cartesianEngine = engine;
});