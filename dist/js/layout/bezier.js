// bezier.js - SVG path generators for family tree edges

/**
 * Creates a smooth vertical cubic Bézier spline between two coordinates.
 * @param {number} x1 - Source X
 * @param {number} y1 - Source Y
 * @param {number} x2 - Target X
 * @param {number} y2 - Target Y
 * @returns {string} SVG path data string
 */
export function createCurvedConnector(x1, y1, x2, y2) {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

/**
 * Creates an orthogonal step connector between two coordinates.
 * @param {number} x1 - Source X
 * @param {number} y1 - Source Y
 * @param {number} x2 - Target X
 * @param {number} y2 - Target Y
 * @returns {string} SVG path data string
 */
export function createOrthogonalConnector(x1, y1, x2, y2) {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
}

/**
 * Creates a straight horizontal line between two points.
 * @param {number} x1
 * @param {number} y
 * @param {number} x2
 * @returns {string} SVG path data string
 */
export function createHorizontalConnector(x1, y, x2) {
  return `M ${x1} ${y} H ${x2}`;
}
