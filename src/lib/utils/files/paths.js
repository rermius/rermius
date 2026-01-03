/**
 * Path Utilities
 * Consolidated from path/ folder and filename-utils
 */

/**
 * File info related functions - ADAPTED FROM ELECTERM
 */

// Detect Windows environment
export const isWin =
	typeof window !== 'undefined' &&
	(navigator.platform.includes('Win') || navigator.userAgent.includes('Windows'));

export const getFileExt = fileName => {
	const sep = '.';
	const arr = fileName.split(sep);
	const len = arr.length;
	if (len === 1) {
		return { base: fileName, ext: '' };
	}
	return {
		base: arr.slice(0, len - 1).join(sep),
		ext: arr[len - 1] || ''
	};
};

export const getFolderFromFilePath = (filePath, isRemote) => {
	const sep = isRemote ? '/' : isWin ? '\\' : '/';
	const arr = filePath.split(sep);
	const len = arr.length;
	const isWinDisk = isWin && filePath.endsWith(sep);

	const path = isWinDisk ? '/' : arr.slice(0, len - 1).join(sep);
	const name = isWinDisk ? filePath.replace(sep, '') : arr[len - 1];

	return {
		path,
		name,
		...getFileExt(name)
	};
};

export const isAbsolutePath = (path = '') => {
	return path.startsWith('/') || /^[a-zA-Z]:/.test(path);
};

// ================== PATH RESOLUTION ==================
/**
 * smart resolve function - COPY FROM ELECTERM
 * Handles both Unix and Windows paths correctly
 * @param {String} basePath
 * @param {String} nameOrDot
 * @return {String}
 */
export function resolve(basePath, nameOrDot) {
	const hasWinDrive = path => /^[a-zA-Z]:/.test(path);
	const isWin =
		basePath.includes('\\') ||
		nameOrDot.includes('\\') ||
		hasWinDrive(basePath) ||
		hasWinDrive(nameOrDot);
	const sep = isWin ? '\\' : '/';

	if (/^[a-zA-Z]:/.test(nameOrDot)) {
		return nameOrDot.replace(/^\//, '').replace(/\//g, sep);
	}
	if (nameOrDot.startsWith('/')) {
		return nameOrDot.replace(/\\/g, sep);
	}
	if (nameOrDot === '..') {
		const baseEndsWithSep = basePath.endsWith(sep);
		const parts = basePath.split(sep);
		if (parts.length > 1) {
			parts.pop();
			if (isWin && parts.length === 1) {
				return baseEndsWithSep ? '/' : parts.join(sep);
			}
			return parts.join(sep) || '/';
		}
		return '/';
	}
	const result = basePath.endsWith(sep) ? basePath + nameOrDot : basePath + sep + nameOrDot;
	return isWin && result.length === 3 && result.endsWith(':\\') ? '/' : result;
}

// ================== UNIQUE PATH GENERATION ==================
/**
 * Unique Path Generator Utilities
 * Handles duplicate file detection and unique name generation
 * Pattern: filename (1).ext, filename (2).ext, etc.
 */

import { getRemoteFileStat, getLocalFileStat } from '$lib/services';

const MAX_DUPLICATE_COUNTER = 1000;
const MAX_FILENAME_LENGTH = 255;

/**
 * Parse filename into base name and extension
 * @param {string} fileName - Full filename
 * @returns {{ baseName: string, ext: string }}
 */
export function parseFileName(fileName) {
	const lastDotIndex = fileName.lastIndexOf('.');
	// No extension or hidden file (starts with dot)
	if (lastDotIndex <= 0) {
		return { baseName: fileName, ext: '' };
	}
	return {
		baseName: fileName.substring(0, lastDotIndex),
		ext: fileName.substring(lastDotIndex) // includes the dot
	};
}

/**
 * Check if remote file exists
 * @param {string} sessionId - Session ID
 * @param {string} path - File path to check
 * @returns {Promise<boolean>}
 */
export async function remoteFileExists(sessionId, path) {
	try {
		await getRemoteFileStat(sessionId, path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if local file exists
 * @param {string} path - File path to check
 * @returns {Promise<boolean>}
 */
export async function localFileExists(path) {
	try {
		await getLocalFileStat(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Generate unique remote path by checking existence and incrementing counter
 * @param {string} sessionId - Session ID
 * @param {string} directory - Target directory path
 * @param {string} fileName - Original file name
 * @returns {Promise<{ path: string, renamed: boolean, originalName: string, newName: string }>}
 */
export async function generateUniqueRemotePath(sessionId, directory, fileName) {
	const { baseName, ext } = parseFileName(fileName);

	// Normalize directory (remove trailing slash)
	const normalizedDir = directory.endsWith('/') ? directory.slice(0, -1) : directory;
	let newPath = `${normalizedDir}/${fileName}`;

	// Check if original path exists
	if (!(await remoteFileExists(sessionId, newPath))) {
		return { path: newPath, renamed: false, originalName: fileName, newName: fileName };
	}

	// Find unique name with counter
	let counter = 1;
	let newName = fileName;

	while (await remoteFileExists(sessionId, newPath)) {
		newName = generateCounterName(baseName, ext, counter);
		newPath = `${normalizedDir}/${newName}`;
		counter++;

		// Safety limit to prevent infinite loop
		if (counter > MAX_DUPLICATE_COUNTER) {
			throw new Error(`Too many duplicate files: ${fileName}`);
		}
	}

	return { path: newPath, renamed: true, originalName: fileName, newName };
}

/**
 * Generate unique local path by checking existence and incrementing counter
 * @param {string} directory - Target directory path
 * @param {string} fileName - Original file name
 * @returns {Promise<{ path: string, renamed: boolean, originalName: string, newName: string }>}
 */
export async function generateUniqueLocalPath(directory, fileName) {
	const { join } = await import('@tauri-apps/api/path');
	const { baseName, ext } = parseFileName(fileName);

	let newPath = await join(directory, fileName);

	// Check if original path exists
	if (!(await localFileExists(newPath))) {
		return { path: newPath, renamed: false, originalName: fileName, newName: fileName };
	}

	// Find unique name with counter
	let counter = 1;
	let newName = fileName;

	while (await localFileExists(newPath)) {
		newName = generateCounterName(baseName, ext, counter);
		newPath = await join(directory, newName);
		counter++;

		// Safety limit
		if (counter > MAX_DUPLICATE_COUNTER) {
			throw new Error(`Too many duplicate files: ${fileName}`);
		}
	}

	return { path: newPath, renamed: true, originalName: fileName, newName };
}

/**
 * Generate filename with counter suffix
 * Handles long filenames by truncating if necessary
 * @param {string} baseName - Base name without extension
 * @param {string} ext - Extension with dot (e.g., '.txt')
 * @param {number} counter - Counter number
 * @returns {string} New filename like "name (1).ext"
 */
function generateCounterName(baseName, ext, counter) {
	const suffix = ` (${counter})`;
	let newName = `${baseName}${suffix}${ext}`;

	// Check filename length and truncate if necessary
	if (newName.length > MAX_FILENAME_LENGTH) {
		const maxBaseLength = MAX_FILENAME_LENGTH - suffix.length - ext.length;
		const truncatedBase = baseName.substring(0, maxBaseLength);
		newName = `${truncatedBase}${suffix}${ext}`;
	}

	return newName;
}

// ================== FILENAME UTILITIES ==================
/**
 * Filename utilities
 * Reusable functions for generating unique filenames/labels
 */

/**
 * Generate unique filename/label with (N) suffix if duplicates exist
 *
 * @param {string} baseName - Base name (e.g., "file.txt" or "butterhub-vn")
 * @param {Array<string|Object>} existingNames - Array of existing names or objects with name property
 * @param {Object} options - Options
 * @param {boolean} options.caseSensitive - Whether comparison should be case-sensitive (default: false)
 * @param {boolean} options.onlyFiles - If existingNames are file objects, only check files (not directories) (default: false)
 * @param {Function} options.getName - Function to extract name from object: (item) => string (default: item => item.name || item)
 * @returns {string} Unique name (e.g., "file (1).txt" or "butterhub-vn (2)")
 *
 * @example
 * // For file transfers
 * const uniqueName = generateUniqueName('file.txt', fileList, { onlyFiles: true });
 *
 * @example
 * // For tabs
 * const uniqueLabel = generateUniqueName('butterhub-vn', tabs, { getName: t => t.label });
 */
export function generateUniqueName(baseName, existingNames = [], options = {}) {
	const { caseSensitive = false, onlyFiles = false, getName = item => item.name || item } = options;

	// Extract names from objects or use strings directly
	let names;
	if (existingNames.length > 0 && typeof existingNames[0] === 'object') {
		names = existingNames
			.filter(item => !onlyFiles || !item.isDirectory)
			.map(getName)
			.filter(Boolean);
	} else {
		names = existingNames.filter(Boolean);
	}

	// Create set of existing names (case-insensitive by default)
	const existingSet = new Set(caseSensitive ? names : names.map(n => String(n).toLowerCase()));

	const baseLower = caseSensitive ? baseName : baseName.toLowerCase();

	// Check if original name exists
	if (!existingSet.has(baseLower)) {
		return baseName;
	}

	// Extract base name and extension for files
	// For tabs/labels without extension, treat entire string as base
	const lastDotIndex = baseName.lastIndexOf('.');
	const hasExtension = lastDotIndex > 0 && lastDotIndex < baseName.length - 1;

	const base = hasExtension ? baseName.substring(0, lastDotIndex) : baseName;
	const ext = hasExtension ? baseName.substring(lastDotIndex) : '';

	// Find next available number
	let counter = 1;
	let newName;
	do {
		newName = `${base} (${counter})${ext}`;
		const newNameLower = caseSensitive ? newName : newName.toLowerCase();
		if (!existingSet.has(newNameLower)) {
			return newName;
		}
		counter++;
	} while (counter < 1000);

	// Fallback: if we somehow exceed 1000, return with timestamp
	return `${base} (${Date.now()})${ext}`;
}

/**
 * Generate unique filename for file transfers
 * Convenience wrapper for generateUniqueName with file-specific options
 *
 * @param {string} fileName - Original filename (e.g., "file.txt")
 * @param {Array<Object>} fileList - Array of file objects with {name, isDirectory} properties
 * @returns {string} Unique filename (e.g., "file (1).txt")
 */
export function generateUniqueFileName(fileName, fileList = []) {
	return generateUniqueName(fileName, fileList, {
		onlyFiles: true,
		caseSensitive: false
	});
}

/**
 * Generate unique tab label
 * Convenience wrapper for generateUniqueName with tab-specific options
 *
 * @param {string} baseLabel - Base label (e.g., "butterhub-vn")
 * @param {Array<Object>} existingTabs - Array of tab objects with {label} property
 * @returns {string} Unique label (e.g., "butterhub-vn (2)")
 */
export function generateUniqueTabLabel(baseLabel, existingTabs = []) {
	return generateUniqueName(baseLabel, existingTabs, {
		getName: tab => tab.label,
		caseSensitive: false
	});
}
