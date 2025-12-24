/**
 * Generic helper functions
 */

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
	if (obj === null || typeof obj !== 'object') return obj;

	try {
		return JSON.parse(JSON.stringify(obj));
	} catch (error) {
		console.error('Failed to deep clone:', error);
		return obj;
	}
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if object is empty
 */
export function isEmpty(obj) {
	if (obj === null || obj === undefined) return true;
	if (Array.isArray(obj)) return obj.length === 0;
	if (typeof obj === 'object') return Object.keys(obj).length === 0;
	if (typeof obj === 'string') return obj.trim() === '';
	return false;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in ms
 * @returns {Promise<*>} Result of function
 */
export async function retry(fn, maxRetries = 3, delay = 1000) {
	let lastError;

	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (i < maxRetries - 1) {
				await sleep(delay * Math.pow(2, i));
			}
		}
	}

	throw lastError;
}

/**
 * Group array of objects by property
 * @param {Array} array - Array to group
 * @param {string|Function} key - Property name or function to get key
 * @returns {Object} Grouped object
 */
export function groupBy(array, key) {
	if (!Array.isArray(array)) return {};

	const getKey = typeof key === 'function' ? key : item => item[key];

	return array.reduce((result, item) => {
		const groupKey = getKey(item);
		if (!result[groupKey]) {
			result[groupKey] = [];
		}
		result[groupKey].push(item);
		return result;
	}, {});
}

/**
 * Remove duplicates from array
 * @param {Array} array - Array with potential duplicates
 * @param {string|Function} key - Optional key to determine uniqueness
 * @returns {Array} Array without duplicates
 */
export function unique(array, key = null) {
	if (!Array.isArray(array)) return [];

	if (!key) {
		return [...new Set(array)];
	}

	const getKey = typeof key === 'function' ? key : item => item[key];
	const seen = new Set();

	return array.filter(item => {
		const k = getKey(item);
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

/**
 * Sort array of objects by property
 * @param {Array} array - Array to sort
 * @param {string|Function} key - Property name or function to get value
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
export function sortBy(array, key, order = 'asc') {
	if (!Array.isArray(array)) return [];

	const getValue = typeof key === 'function' ? key : item => item[key];
	const multiplier = order === 'desc' ? -1 : 1;

	return [...array].sort((a, b) => {
		const aVal = getValue(a);
		const bVal = getValue(b);

		if (aVal < bVal) return -1 * multiplier;
		if (aVal > bVal) return 1 * multiplier;
		return 0;
	});
}

/**
 * Omit properties from object
 * @param {Object} obj - Source object
 * @param {Array<string>} keys - Keys to omit
 * @returns {Object} New object without specified keys
 */
export function omit(obj, keys) {
	if (!obj || typeof obj !== 'object') return obj;

	const result = { ...obj };
	keys.forEach(key => delete result[key]);
	return result;
}

/**
 * Pick properties from object
 * @param {Object} obj - Source object
 * @param {Array<string>} keys - Keys to pick
 * @returns {Object} New object with only specified keys
 */
export function pick(obj, keys) {
	if (!obj || typeof obj !== 'object') return {};

	const result = {};
	keys.forEach(key => {
		if (key in obj) {
			result[key] = obj[key];
		}
	});
	return result;
}

/**
 * Clamp number between min and max
 * @param {number} num - Number to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped number
 */
export function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

/**
 * Random number between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random number
 */
export function random(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
