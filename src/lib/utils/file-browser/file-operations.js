/**
 * File operations utilities
 * Separated from components for reusability
 */

/**
 * Create a new empty file
 */
export async function createEmptyFile(path, type, sessionId = null) {
	if (type === 'local') {
		const { writeTextFile } = await import('@tauri-apps/plugin-fs');
		await writeTextFile(path, '');
	} else if (sessionId) {
		const { writeFileContent } = await import('$lib/services');
		await writeFileContent(sessionId, path, '', false);
	} else {
		throw new Error('No session ID provided for remote file creation');
	}
}

/**
 * Create a new file object for adding to file list
 */
export function createNewFileObject(name, path, type) {
	return {
		name,
		path,
		isDirectory: false,
		size: 0,
		modified: new Date().toISOString(),
		permissions: type !== 'local' ? '-rw-r--r--' : undefined
	};
}

/**
 * Create a new folder object for adding to file list
 */
export function createNewFolderObject(name, path, type) {
	return {
		name,
		path,
		isDirectory: true,
		size: 0,
		modified: new Date().toISOString(),
		permissions: type !== 'local' ? 'drwxr-xr-x' : undefined
	};
}

/**
 * Build new path from current path and name
 */
export function buildNewPath(currentPath, name) {
	return `${currentPath}/${name}`.replace(/\/+/g, '/');
}
