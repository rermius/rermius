/**
 * Unique Path Generator Utilities
 * Handles duplicate file detection and unique name generation
 * Pattern: filename (1).ext, filename (2).ext, etc.
 */

import { getRemoteFileStat, getLocalFileStat } from '$lib/services/file-browser';

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
