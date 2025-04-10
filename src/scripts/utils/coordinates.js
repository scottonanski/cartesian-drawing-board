// utils/coordinates.js
export function toScreenCoords(cartesianX, cartesianY, originX, originY) {
    return { x: originX + cartesianX, y: originY - cartesianY };
}

export function toCartesianCoords(screenX, screenY, originX, originY) {
    return { x: screenX - originX, y: -(screenY - originY) };
}

