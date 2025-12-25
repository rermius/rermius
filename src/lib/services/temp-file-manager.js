/**
 * Temporary File Manager
 * Manages temporary files created for remote file editing
 * Handles cleanup on app close or after timeout
 */

import { tempDir } from '@tauri-apps/api/path';
import { remove } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { statusBarStore } from '$lib/stores/status-bar';

const TEMP_FILE_PREFIX = 'rermius-temp-';
const CLEANUP_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Track active temp files: Map<tempFilePath, { remotePath, sessionId, createdAt, timeoutId, unlistenFn, onUploadProgress }>
const activeTempFiles = new Map();

// Track file change listener
let fileChangeUnlisten = null;

/**
 * Create a temporary file path for remote file
 * @param {string} remotePath - Original remote file path
 * @param {string} fileName - File name
 * @returns {Promise<string>} Temporary file path
 */
export async function createTempFilePath(remotePath, fileName) {
	const tempDirPath = await tempDir();
	const timestamp = Date.now();
	const tempFilePath = `${tempDirPath}/${TEMP_FILE_PREFIX}${timestamp}-${fileName}`;
	return tempFilePath;
}

/**
 * Register a temporary file for tracking and cleanup
 * @param {string} tempFilePath - Temporary file path
 * @param {string} remotePath - Original remote file path
 * @param {string} sessionId - Session ID
 * @param {Function} onCleanup - Optional cleanup callback
 */
export function registerTempFile(tempFilePath, remotePath, sessionId, onCleanup = null) {
	// Clear existing timeout if any
	if (activeTempFiles.has(tempFilePath)) {
		const existing = activeTempFiles.get(tempFilePath);
		if (existing.timeoutId) {
			clearTimeout(existing.timeoutId);
		}
	}

	// Set cleanup timeout
	const timeoutId = setTimeout(async () => {
		await cleanupTempFile(tempFilePath, onCleanup);
	}, CLEANUP_TIMEOUT);

	activeTempFiles.set(tempFilePath, {
		remotePath,
		sessionId,
		createdAt: Date.now(),
		timeoutId,
		onCleanup,
		unlistenFn: null
	});
}

/**
 * Unregister a temporary file (when file is closed/uploaded)
 * @param {string} tempFilePath - Temporary file path
 */
export async function unregisterTempFile(tempFilePath) {
	if (activeTempFiles.has(tempFilePath)) {
		const fileInfo = activeTempFiles.get(tempFilePath);
		if (fileInfo.timeoutId) {
			clearTimeout(fileInfo.timeoutId);
		}
		// Stop watching if active
		if (fileInfo.unlistenFn) {
			await stopWatching(tempFilePath);
		}
		activeTempFiles.delete(tempFilePath);
	}
}

/**
 * Cleanup a single temporary file
 * @param {string} tempFilePath - Temporary file path
 * @param {Function} onCleanup - Optional cleanup callback
 */
export async function cleanupTempFile(tempFilePath, onCleanup = null) {
	try {
		// Call custom cleanup callback if provided
		if (onCleanup) {
			await onCleanup(tempFilePath);
		}

		// Remove file from filesystem
		await remove(tempFilePath);

		// Unregister from tracking
		unregisterTempFile(tempFilePath);
	} catch (error) {
		// File might already be deleted or in use
		console.warn('[TempFileManager] Failed to cleanup temp file:', tempFilePath, error);
		unregisterTempFile(tempFilePath);
	}
}

/**
 * Cleanup all temporary files
 */
export async function cleanupAllTempFiles() {
	const tempFiles = Array.from(activeTempFiles.keys());

	for (const tempFilePath of tempFiles) {
		const fileInfo = activeTempFiles.get(tempFilePath);
		await cleanupTempFile(tempFilePath, fileInfo?.onCleanup);
	}
}

/**
 * Get all active temp files
 * @returns {Array<{tempFilePath: string, remotePath: string, sessionId: string, createdAt: number}>}
 */
export function getActiveTempFiles() {
	return Array.from(activeTempFiles.entries()).map(([tempFilePath, info]) => ({
		tempFilePath,
		remotePath: info.remotePath,
		sessionId: info.sessionId,
		createdAt: info.createdAt
	}));
}

/**
 * Get temp file info
 * @param {string} tempFilePath - Temporary file path
 * @returns {Object|null} File info or null if not found
 */
export function getTempFileInfo(tempFilePath) {
	return activeTempFiles.get(tempFilePath) || null;
}

/**
 * Start watching a temp file for changes and auto-upload on save
 * @param {string} tempFilePath - Temporary file path
 */
export async function startWatching(tempFilePath) {
	const fileInfo = activeTempFiles.get(tempFilePath);
	if (!fileInfo) {
		throw new Error(`Temp file not registered: ${tempFilePath}`);
	}

	// Already watching
	if (fileInfo.unlistenFn) {
		return;
	}

	try {
		// Initialize file change listener if not already done
		if (!fileChangeUnlisten) {
			fileChangeUnlisten = await listen('file-changed', async event => {
				const changedPath = event.payload;
				await handleFileChange(changedPath);
			});
		}

		// Start watching file in backend
		await invoke('watch_file', { path: tempFilePath });

		// Mark as watching
		fileInfo.unlistenFn = true; // Actual unlisten happens globally
	} catch (error) {
		console.error('[TempFileManager] Failed to start watching:', error);
		throw error;
	}
}

/**
 * Stop watching a temp file
 * @param {string} tempFilePath - Temporary file path
 */
export async function stopWatching(tempFilePath) {
	const fileInfo = activeTempFiles.get(tempFilePath);
	if (!fileInfo || !fileInfo.unlistenFn) {
		return;
	}

	try {
		await invoke('unwatch_file', { path: tempFilePath });
		fileInfo.unlistenFn = null;
	} catch (error) {
		console.error('[TempFileManager] Failed to stop watching:', error);
	}
}

// Debounce tracking for file changes
const pendingUploads = new Map();
const FRONTEND_DEBOUNCE_MS = 1000;

/**
 * Handle file change event - upload file back to remote
 * @param {string} tempFilePath - Temporary file path that was changed
 */
async function handleFileChange(tempFilePath) {
	// Frontend debounce - prevent multiple uploads
	if (pendingUploads.has(tempFilePath)) {
		return;
	}

	const fileInfo = activeTempFiles.get(tempFilePath);
	if (!fileInfo) {
		return;
	}

	const { remotePath, sessionId } = fileInfo;
	const fileName = tempFilePath.split('/').pop() || tempFilePath.split('\\').pop() || 'file';

	// Mark as pending
	pendingUploads.set(tempFilePath, true);

	try {
		// Notify upload starting via store
		statusBarStore.showUpload(fileName, 0, 'uploading');

		// Upload file back to remote
		const { uploadFile } = await import('./file-browser');
		await uploadFile(sessionId, tempFilePath, remotePath, crypto.randomUUID());

		// Notify upload complete via store
		statusBarStore.showUpload(fileName, 100, 'success');
	} catch (error) {
		console.error('[TempFileManager] Auto-upload failed:', error);

		// Notify upload error via store
		statusBarStore.showUpload(fileName, 0, 'error', error.message || 'Upload failed');
	} finally {
		// Clear pending after debounce period
		setTimeout(() => {
			pendingUploads.delete(tempFilePath);
		}, FRONTEND_DEBOUNCE_MS);
	}
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', async () => {
		// Cleanup global file change listener
		if (fileChangeUnlisten) {
			fileChangeUnlisten();
			fileChangeUnlisten = null;
		}
		await cleanupAllTempFiles().catch(console.error);
	});
}
