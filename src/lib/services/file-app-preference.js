/**
 * File App Preference Service
 * Manages which application to use for opening files by extension
 */

const STORAGE_KEY = 'file_app_preferences';

/**
 * Get app preference for a file extension
 * @param {string} extension - File extension (e.g., 'txt', 'pdf')
 * @returns {string|null} App path or null if not set
 */
export function getAppPreference(extension) {
	try {
		const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		return prefs[extension.toLowerCase()] || null;
	} catch {
		return null;
	}
}

/**
 * Set app preference for a file extension
 * @param {string} extension - File extension (e.g., 'txt', 'pdf')
 * @param {string} appPath - Path to the application
 */
export function setAppPreference(extension, appPath) {
	try {
		const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		prefs[extension.toLowerCase()] = appPath;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch (e) {
		console.error('Failed to save app preference:', e);
	}
}

/**
 * Get file extension from path
 * @param {string} path - File path
 * @returns {string} File extension (without dot)
 */
export function getFileExtension(path) {
	const parts = path.split('.');
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Clear app preference for a file extension
 * @param {string} extension - File extension
 */
export function clearAppPreference(extension) {
	try {
		const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		delete prefs[extension.toLowerCase()];
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch (e) {
		console.error('Failed to clear app preference:', e);
	}
}

/**
 * Get all app preferences
 * @returns {Object} Map of extension -> app path
 */
export function getAllAppPreferences() {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
	} catch {
		return {};
	}
}
