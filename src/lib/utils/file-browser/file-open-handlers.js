/**
 * File open handlers
 * Separated from FilePanel for reusability
 */

/**
 * Handle opening a file with preferred app or system default
 */
export async function handleOpenFile(file, type, sessionId) {
	if (type === 'local' || type === 'ftp' || type === 'sftp') {
		const { openFileWithApp, openFileWithSystem, showOpenWithDialog } =
			await import('$lib/services/file-browser');
		const { getAppPreference, getFileExtension, setAppPreference } =
			await import('$lib/services/file-app-preference');

		let filePath = file.path;

		// For remote files, download to temp first
		if (type !== 'local' && sessionId) {
			const { downloadFile } = await import('$lib/services/file-browser');
			const { createTempFilePath, registerTempFile, startWatching } =
				await import('$lib/services/temp-file-manager');

			const tempFilePath = await createTempFilePath(file.path, file.name);
			await downloadFile(sessionId, file.path, tempFilePath, crypto.randomUUID());
			filePath = tempFilePath;

			// Register temp file for cleanup and auto-upload
			registerTempFile(tempFilePath, file.path, sessionId);

			// Start watching for file changes
			try {
				await startWatching(tempFilePath);
			} catch (e) {
				console.error('[FilePanel] Failed to start watching:', e);
			}
		}

		const extension = getFileExtension(file.name);
		const preferredApp = getAppPreference(extension);

		if (preferredApp) {
			// Use preferred app
			await openFileWithApp(filePath, preferredApp);
		} else {
			// First time: show dialog to select app
			try {
				const selectedApp = await showOpenWithDialog(filePath);
				if (selectedApp) {
					setAppPreference(extension, selectedApp);
					await openFileWithApp(filePath, selectedApp);
				} else {
					// User cancelled or no app selected, use system default
					await openFileWithSystem(filePath);
				}
			} catch (dialogError) {
				// Dialog cancelled or error, fallback to system default
				await openFileWithSystem(filePath);
			}
		}
	}
}

/**
 * Handle opening a file with "Open With" dialog
 */
export async function handleOpenWithFile(file, type, sessionId) {
	if (type === 'local' || type === 'ftp' || type === 'sftp') {
		const { openFileWithApp, showOpenWithDialog } = await import('$lib/services/file-browser');
		const { getFileExtension, setAppPreference } =
			await import('$lib/services/file-app-preference');

		let filePath = file.path;

		// For remote files, download to temp first
		if (type !== 'local' && sessionId) {
			const { downloadFile } = await import('$lib/services/file-browser');
			const { createTempFilePath, registerTempFile, startWatching } =
				await import('$lib/services/temp-file-manager');

			const tempFilePath = await createTempFilePath(file.path, file.name);
			await downloadFile(sessionId, file.path, tempFilePath, crypto.randomUUID());
			filePath = tempFilePath;

			// Register temp file for cleanup and auto-upload
			registerTempFile(tempFilePath, file.path, sessionId);

			// Start watching for file changes
			try {
				await startWatching(tempFilePath);
			} catch (e) {
				console.error('[FilePanel] Failed to start watching:', e);
			}
		}

		try {
			const selectedApp = await showOpenWithDialog(filePath);
			if (selectedApp) {
				const extension = getFileExtension(file.name);
				setAppPreference(extension, selectedApp);
				await openFileWithApp(filePath, selectedApp);
			}
			// If cancelled, do nothing (user explicitly cancelled)
		} catch (dialogError) {
			// Dialog error, but don't show error to user (they cancelled)
		}
	}
}
