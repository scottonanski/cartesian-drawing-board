import { getElementAtScreenCoords, calculateNewDimensions, getResizeCursor, getHandleAtScreenCoords } from './utils/interactionUtils.js';
import { toCartesianCoords } from './utils/coordinates.js';
import { markDirty, markEntireCanvasDirty } from './dirtyRegions.js';
import { startEditing, stopEditing, updateEditOverlay } from './editing.js';

export function createMouseMoveHandler(renderer) {
  return function handleMouseMove(event) {
    const rect = renderer.canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const cartesianPoint = renderer.toCartesianCoords(screenX, screenY);
    renderer.currentMousePosCartesian = cartesianPoint;

    if (renderer.currentTool === 'pen') {
      if (renderer.bezierDrawingState === 'definingP1') {
        renderer.currentCurvePoints.p1 = cartesianPoint;
        renderer.markEntireCanvasDirty();
      } else if (renderer.bezierDrawingState === 'definingP2') {
        renderer.markEntireCanvasDirty();
      }
      return;
    }

    if (renderer.currentTool === 'select') {
      console.log('MouseMove - Dragging:', renderer.dragging, 'Selected:', renderer.selectedElement);
      if (renderer.dragging && renderer.selectedElement) {
        markDirty(renderer, renderer.selectedElement);
        const cartesianMouse = toCartesianCoords(screenX, screenY, renderer.originX, renderer.originY);
        renderer.selectedElement.x = cartesianMouse.x - renderer.dragOffsetX;
        renderer.selectedElement.y = cartesianMouse.y - renderer.dragOffsetY;
        markDirty(renderer, renderer.selectedElement);
        renderer.canvas.style.cursor = 'grabbing';
      } else if (!renderer.editingElement) {
        const hitInfo = getElementAtScreenCoords(renderer, screenX, screenY);
        renderer.canvas.style.cursor = hitInfo ? 'move' : 'default';
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

    if (renderer.currentTool === 'pen') {
      if (renderer.bezierDrawingState === 'idle') {
        renderer.bezierDrawingState = 'definingP1';
        renderer.currentCurvePoints.p0 = renderer.currentCurvePoints.p0 || cartesianPoint;
        renderer.currentCurvePoints.p1 = cartesianPoint;
        renderer.currentCurvePoints.p3 = null;
        renderer.markEntireCanvasDirty();
      } else if (renderer.bezierDrawingState === 'p1Defined') {
        renderer.bezierDrawingState = 'definingP2';
        renderer.currentCurvePoints.p3 = cartesianPoint;
        renderer.currentMousePosCartesian = cartesianPoint;
        renderer.markEntireCanvasDirty();
      }
      return;
    }

    if (renderer.currentTool === 'select') {
      const hitInfo = getElementAtScreenCoords(renderer, screenX, screenY);
      console.log('Hit Info:', hitInfo);
      let selectedElement = hitInfo && hitInfo.element ? hitInfo.element : hitInfo;
      if (selectedElement && typeof hitInfo?.handleType === 'undefined') {
        renderer.selectedElement = selectedElement;
        console.log('Selected Element:', renderer.selectedElement);
        renderer.dragging = true;
        console.log('After dragging set:', renderer.selectedElement);
        const cartesianMouse = toCartesianCoords(screenX, screenY, renderer.originX, renderer.originY);
        console.log('After toCartesianCoords:', renderer.selectedElement);
        renderer.dragOffsetX = cartesianMouse.x - renderer.selectedElement.x;
        renderer.dragOffsetY = cartesianMouse.y - renderer.selectedElement.y;
        console.log('After offsets:', renderer.selectedElement);
        renderer.markDirty(renderer.selectedElement);
        console.log('After markDirty:', renderer.selectedElement);
      } else {
        console.log('No draggable element hit');
        renderer.selectedElement = null;
        renderer.dragging = false;
      }
      console.log('MouseDown Select: Hit Info:', hitInfo);
      console.log('Selected element:', renderer.selectedElement);
      console.log('MouseDown Select: Starting drag');
    }
    console.log('MouseDown End: dragging=' + renderer.dragging + ', resizing=' + renderer.resizing + ', selectedElement ID=' + (renderer.selectedElement ? renderer.selectedElement.id : 'undefined'));
  };
}

function reflectPoint(pointToReflect, centerPoint) {
  return {
    x: centerPoint.x + (centerPoint.x - pointToReflect.x),
    y: centerPoint.y + (centerPoint.y - pointToReflect.y)
  };
}

export function createMouseUpHandler(renderer) {
  return function handleMouseUp(event) {
    const rect = renderer.canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const cartesianPoint = renderer.toCartesianCoords(screenX, screenY);

    if (renderer.currentTool === 'pen') {
      if (renderer.bezierDrawingState === 'definingP1') {
        renderer.currentCurvePoints.p1 = cartesianPoint;
        renderer.bezierDrawingState = 'p1Defined';
        renderer.markEntireCanvasDirty();
      } else if (renderer.bezierDrawingState === 'definingP2') {
        const p0 = renderer.currentCurvePoints.p0;
        const p1 = renderer.currentCurvePoints.p1;
        const p3 = renderer.currentCurvePoints.p3;
        const p2 = reflectPoint(cartesianPoint, p3);
        if (!p0 || !p1 || !p2 || !p3) {
          console.error("Missing points:", { p0, p1, p2, p3 });
          renderer.bezierDrawingState = 'idle';
          renderer.currentCurvePoints = { p0: null, p1: null, p3: null };
          renderer.markEntireCanvasDirty();
          renderer.currentMousePosCartesian = null;
          return;
        }
        renderer.addBezierCurve(p0, p1, p2, p3);
        renderer.currentCurvePoints.p0 = p3;
        renderer.currentCurvePoints.p1 = reflectPoint(p2, p3);
        renderer.currentCurvePoints.p3 = null;
        renderer.bezierDrawingState = 'p1Defined';
      }
      renderer.currentMousePosCartesian = null;
      return;
    }

    if (renderer.currentTool === 'select') {
      console.log('MouseUp Select: Finalizing drag');
      if (renderer.dragging && renderer.selectedElement) {
        renderer.dragging = false;
        renderer.markDirty(renderer.selectedElement);
      }
      const hitInfo = getElementAtScreenCoords(renderer, screenX, screenY);
      console.log('MouseUp Select: Final cursor check. Hit info:', hitInfo ? hitInfo.element ? hitInfo.element.id : 'Element undefined' : 'null');
      renderer.canvas.style.cursor = hitInfo ? 'move' : 'default';
    }
  };
}

export function createDoubleClickHandler(renderer) {
  return function handleDoubleClick(event) {
    renderer.dragging = false;
    const overlay = document.querySelector('.edit-overlay');
    const isClickOnOverlay = overlay && event.target === overlay;
    if (isClickOnOverlay) return;

    if (renderer.editingElement && !isClickOnOverlay) {
      stopEditing(renderer);
      if (renderer.currentTool === 'select') {
        renderer.canvas.style.cursor = 'default';
      }
      return;
    }

    const rect = renderer.canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const element = getElementAtScreenCoords(renderer, screenX, screenY);

    if (renderer.currentTool === 'select' && element && typeof element.handleType === 'undefined' && element.type === "text") {
      startEditing(renderer, element);
    } else if (renderer.currentTool === 'select') {
      const handleInfo = getHandleAtScreenCoords(renderer, screenX, screenY, renderer.selectedElement);
      if (handleInfo) {
        renderer.canvas.style.cursor = getResizeCursor(handleInfo.type);
      } else if (element && typeof element.handleType === 'undefined') {
        renderer.canvas.style.cursor = 'move';
      } else {
        renderer.canvas.style.cursor = 'default';
      }
    }
  };
}

export function createMouseLeaveHandler(renderer) {
  return function handleMouseLeave(event) {
    if (renderer.resizing || renderer.dragging) {
      console.log("Mouse left canvas during drag/resize - finalizing action.");
      createMouseUpHandler(renderer)(event);
      renderer.canvas.style.cursor = 'default';
    } else if (!renderer.editingElement) {
      renderer.canvas.style.cursor = 'default';
    }
  };
}

export function createResizeHandler(renderer) {
  return function handleResize() {
    markEntireCanvasDirty(renderer);
    renderer.setupCanvas();
    if (renderer.editingElement) {
      updateEditOverlay(renderer);
    }
  };
}