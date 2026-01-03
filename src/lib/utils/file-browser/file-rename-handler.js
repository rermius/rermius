/**
 * File rename handler
 * Separated from FilePanel for reusability
 */

/**
 * Handle renaming a file
 */
export async function handleRenameFile(file, currentPath, type, sessionId, renameInProgress) {
	// Prevent duplicate rename calls
	const renameKey = `${file.path}->${file.newName}`;
	if (renameInProgress.has(renameKey)) {
		return null;
	}
	renameInProgress.add(renameKey);

	try {
		const { renameLocalPath, renameRemotePath } = await import('$lib/services');
		const oldPath = file.path;
		const newName = file.newName;

		// Build new path: replace filename in oldPath with newName
		let newPath;
		if (type === 'local') {
			// For local: use backslash on Windows
			const normalizedOld = oldPath.replace(/\//g, '\\');
			const lastSep = normalizedOld.lastIndexOf('\\');
			if (lastSep >= 0) {
				newPath = `${normalizedOld.substring(0, lastSep + 1)}${newName}`;
			} else {
				// Root case: file is in root directory
				newPath = `${normalizedOld}\\${newName}`;
			}
		} else {
			// For remote (SFTP/FTP): use forward slash
			const normalizedOld = oldPath.replace(/\\/g, '/').replace(/\/+/g, '/');
			const lastSep = normalizedOld.lastIndexOf('/');
			if (lastSep >= 0) {
				// Normal case: file is in a directory
				newPath = `${normalizedOld.substring(0, lastSep + 1)}${newName}`;
			} else {
				// Root case: file is in root directory
				newPath = `/${newName}`;
			}
		}
		if (type === 'local') {
			await renameLocalPath(oldPath, newPath);
		} else if (sessionId) {
			await renameRemotePath(sessionId, oldPath, newPath);
		} else {
			throw new Error('No session ID provided for remote rename');
		}

		return { oldPath, newPath, newName };
	} finally {
		renameInProgress.delete(renameKey);
	}
}
