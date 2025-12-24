/**
 * Calculate optimal position for a dropdown/menu to avoid being cut off at screen edges
 * @param {Object} options - Position calculation options
 * @param {number} options.x - Initial X position (clientX)
 * @param {number} options.y - Initial Y position (clientY)
 * @param {number} options.width - Menu width in pixels
 * @param {number} options.height - Menu height in pixels
 * @param {number} [options.padding=10] - Padding from screen edges
 * @param {number} [options.viewportWidth] - Viewport width (defaults to window.innerWidth)
 * @param {number} [options.viewportHeight] - Viewport height (defaults to window.innerHeight)
 * @returns {{x: number, y: number}} Adjusted position
 */
export function calculateDropdownPosition({
	x,
	y,
	width,
	height,
	padding = 10,
	viewportWidth = window.innerWidth,
	viewportHeight = window.innerHeight
}) {
	let adjustedX = x;
	let adjustedY = y;

	// Adjust horizontal: if menu extends beyond right edge, shift left
	if (x + width > viewportWidth - padding) {
		adjustedX = Math.max(padding, viewportWidth - width - padding);
	}

	// Adjust vertical: if menu extends beyond bottom edge, shift up
	if (y + height > viewportHeight - padding) {
		adjustedY = Math.max(padding, y - height);
	}

	// Ensure menu doesn't go off left or top edges
	if (adjustedX < padding) adjustedX = padding;
	if (adjustedY < padding) adjustedY = padding;

	return { x: adjustedX, y: adjustedY };
}

/**
 * Adjust dropdown position after DOM element is rendered
 * Uses getBoundingClientRect to get actual dimensions
 * @param {HTMLElement} element - The dropdown menu element
 * @param {number} initialX - Initial X position (clientX)
 * @param {number} initialY - Initial Y position (clientY)
 * @param {number} [padding=10] - Padding from screen edges
 * @returns {{x: number, y: number}} Adjusted position
 */
export function adjustDropdownPosition(element, initialX, initialY, padding = 10) {
	if (!element) {
		return { x: initialX, y: initialY };
	}

	const rect = element.getBoundingClientRect();
	return calculateDropdownPosition({
		x: initialX,
		y: initialY,
		width: rect.width,
		height: rect.height,
		padding
	});
}
