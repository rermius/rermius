import { browser } from '$app/environment';

/**
 * Browser localStorage wrapper with JSON serialization support
 * Safely handles non-browser environments (SSR/SSG)
 */
export const localStorage = {
	/**
	 * Get item from localStorage
	 * @param {string} key - Storage key
	 * @param {*} defaultValue - Default value if key doesn't exist
	 * @returns {*} Parsed value or default
	 */
	get(key, defaultValue = null) {
		if (!browser) return defaultValue;

		try {
			const value = window.localStorage.getItem(key);
			if (value === null) return defaultValue;

			// Try to parse as JSON, fall back to raw string
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		} catch (error) {
			console.error(`Failed to get localStorage key "${key}":`, error);
			return defaultValue;
		}
	},

	/**
	 * Set item in localStorage
	 * @param {string} key - Storage key
	 * @param {*} value - Value to store (will be JSON stringified)
	 * @returns {boolean} Success status
	 */
	set(key, value) {
		if (!browser) return false;

		try {
			const serialized = JSON.stringify(value);
			window.localStorage.setItem(key, serialized);
			return true;
		} catch (error) {
			console.error(`Failed to set localStorage key "${key}":`, error);
			return false;
		}
	},

	/**
	 * Remove item from localStorage
	 * @param {string} key - Storage key to remove
	 * @returns {boolean} Success status
	 */
	remove(key) {
		if (!browser) return false;

		try {
			window.localStorage.removeItem(key);
			return true;
		} catch (error) {
			console.error(`Failed to remove localStorage key "${key}":`, error);
			return false;
		}
	},

	/**
	 * Clear all localStorage items
	 * @returns {boolean} Success status
	 */
	clear() {
		if (!browser) return false;

		try {
			window.localStorage.clear();
			return true;
		} catch (error) {
			console.error('Failed to clear localStorage:', error);
			return false;
		}
	},

	/**
	 * Check if key exists in localStorage
	 * @param {string} key - Storage key
	 * @returns {boolean} True if key exists
	 */
	has(key) {
		if (!browser) return false;

		try {
			return window.localStorage.getItem(key) !== null;
		} catch (error) {
			console.error(`Failed to check localStorage key "${key}":`, error);
			return false;
		}
	},

	/**
	 * Get all keys in localStorage
	 * @returns {string[]} Array of all keys
	 */
	keys() {
		if (!browser) return [];

		try {
			return Object.keys(window.localStorage);
		} catch (error) {
			console.error('Failed to get localStorage keys:', error);
			return [];
		}
	}
};
