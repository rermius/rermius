/**
 * File action handlers
 * Separated from FilePanel for reusability
 */

import { createEmptyFile, buildNewPath } from './file-operations';
import { getLocalFileStat, getRemoteFileStat } from '$lib/services';

/**
 * Convert stat info to file object format
 */
function statToFileObject(stat, name, path, isDirectory) {
	return {
		name,
		path,
		isDirectory,
		size: stat.size || 0,
		modified: stat.modified
			? new Date(stat.modified * 1000).toISOString()
			: new Date().toISOString(),
		permissions: stat.permissions || (isDirectory ? 'drwxr-xr-x' : '-rw-r--r--')
	};
}

/**
 * Handle creating a new file
 */
export async function handleCreateFile(
	fileName,
	currentPath,
	type,
	sessionId,
	fileService,
	existingFiles = []
) {
	const newPath = buildNewPath(currentPath, fileName);

	// Check if file already exists
	const exists = existingFiles.some(f => f.path === newPath || f.name === fileName);
	if (exists) {
		throw new Error(`File "${fileName}" already exists`);
	}

	// Create the file
	await createEmptyFile(newPath, type, sessionId);

	// Get actual file info from server
	try {
		let stat;
		if (type === 'local') {
			stat = await getLocalFileStat(newPath);
		} else if (sessionId) {
			stat = await getRemoteFileStat(sessionId, newPath);
		} else {
			throw new Error('No session ID provided for remote file stat');
		}

		// Return file object with actual info from server
		return statToFileObject(stat, fileName, newPath, false);
	} catch (e) {
		// If stat fails, return basic info (file was created but we can't get stat)
		console.warn(`[FileActions] Failed to get stat for new file ${newPath}:`, e);
		return {
			name: fileName,
			path: newPath,
			isDirectory: false,
			size: 0,
			modified: new Date().toISOString(),
			permissions: type !== 'local' ? '-rw-r--r--' : undefined
		};
	}
}

/**
 * Handle creating a new folder
 */
export async function handleCreateFolder(
	folderName,
	currentPath,
	type,
	fileService,
	sessionId,
	existingFiles = []
) {
	const newPath = buildNewPath(currentPath, folderName);

	// Check if folder already exists
	const exists = existingFiles.some(f => f.path === newPath || f.name === folderName);
	if (exists) {
		throw new Error(`Folder "${folderName}" already exists`);
	}

	// Create the folder
	await fileService.createDirectory(newPath, type === 'local');

	// Get actual folder info from server
	try {
		let stat;
		if (type === 'local') {
			stat = await getLocalFileStat(newPath);
		} else if (sessionId) {
			stat = await getRemoteFileStat(sessionId, newPath);
		} else {
			throw new Error('No session ID provided for remote folder stat');
		}

		// Return folder object with actual info from server
		return statToFileObject(stat, folderName, newPath, true);
	} catch (e) {
		// If stat fails, return basic info (folder was created but we can't get stat)
		console.warn(`[FileActions] Failed to get stat for new folder ${newPath}:`, e);
		return {
			name: folderName,
			path: newPath,
			isDirectory: true,
			size: 0,
			modified: new Date().toISOString(),
			permissions: type !== 'local' ? 'drwxr-xr-x' : undefined
		};
	}
}

/**
 * Handle deleting files
 */
export async function handleDeleteFiles(filesToDelete, type, fileService) {
	const deletedPaths = new Set();
	for (const f of filesToDelete) {
		console.log(`[Delete] Attempting to delete ${f.isDirectory ? 'directory' : 'file'}: ${f.path}`);
		try {
			await fileService.delete(f.path, f.isDirectory, type === 'local');
			console.log(`[Delete] Successfully deleted: ${f.path}`);
			deletedPaths.add(f.path);
		} catch (e) {
			console.error(`[Delete] Failed to delete ${f.path}:`, e);
			throw e; // Re-throw to let caller handle error
		}
	}
	return deletedPaths;
}
