import { invoke } from '@tauri-apps/api/core';
import { isWin } from '$lib/utils/path/file-utils';

/**
 * File Browser Service
 * Handles both local and remote (SFTP/FTP) file operations
 */

// ============== Windows Drive Detection ==============

/**
 * List Windows drives when at root path "/"
 * Uses PowerShell command like Electerm
 * @returns {Promise<Array<string>>} Array of drive letters (e.g., ["C:", "D:", "E:"])
 */
async function listWindowsDrives() {
	if (!isWin) {
		return [];
	}

	try {
		// Use Tauri command to execute PowerShell
		const drives = await invoke('list_windows_drives');
		return drives || [];
	} catch (e) {
		console.error('[FileBrowser] Failed to list Windows drives:', e);
		// Fallback: try to detect common drives
		return ['C:', 'D:', 'E:'];
	}
}

// ============== Session Management ==============

/**
 * Create a new file transfer session
 * @param {Object} config - Session configuration
 * @param {string} config.connectionType - 'sftp' | 'ftp' | 'ftps'
 * @param {string} config.hostname - Remote host
 * @param {number} config.port - Remote port
 * @param {string} config.username - Username
 * @param {string} [config.password] - Password (for password auth)
 * @param {string} [config.keyPath] - SSH key path (for key auth)
 * @returns {Promise<string>} Session ID
 */
export async function createFileSession(config) {
	return await invoke('create_file_session', { config });
}

/**
 * Close a file transfer session
 * @param {string} sessionId - Session ID to close
 */
export async function closeFileSession(sessionId) {
	return await invoke('close_file_session', { sessionId });
}

// ============== Directory Operations ==============

/**
 * List directory contents (remote)
 * @param {string} sessionId - Session ID
 * @param {string} path - Directory path
 * @returns {Promise<Array>} List of files/directories
 */
export async function listRemoteDirectory(sessionId, path) {
	return await invoke('list_directory', { sessionId, path });
}

/**
 * Get user home directory
 * @returns {Promise<string>} Home directory path
 */
export async function getHomeDirectory() {
	const { homeDir } = await import('@tauri-apps/api/path');
	return await homeDir();
}

/**
 * List local directory contents
 * Uses Tauri fs plugin
 * On Windows, when path is "/", returns list of drives (C:, D:, E:, etc.) like Electerm
 * @param {string} path - Directory path
 * @returns {Promise<Array>} List of files/directories
 */
export async function listLocalDirectory(path) {
	// Handle Windows root path - list drives like Electerm
	if (isWin && (path === '/' || path === '\\' || path === '')) {
		try {
			const drives = await listWindowsDrives();
			const files = [];

			for (const drive of drives) {
				try {
					// Try to stat the drive to get info
					const { stat } = await import('@tauri-apps/plugin-fs');
					const drivePath = drive.endsWith('\\') ? drive : `${drive}\\`;
					const info = await stat(drivePath).catch(() => null);

					files.push({
						name: drive,
						path: drive, // Keep as C:, D:, etc. without trailing slash
						isDirectory: true,
						size: 0,
						modified: info?.mtime ? Math.floor(info.mtime.getTime() / 1000).toString() : null,
						permissions: null
					});
				} catch (e) {
					// If stat fails, still add the drive as a directory
					files.push({
						name: drive,
						path: drive,
						isDirectory: true,
						size: 0,
						modified: null,
						permissions: null
					});
				}
			}

			console.log(
				`[FileBrowser] Found ${files.length} drives:`,
				files.map(f => f.name)
			);
			return files;
		} catch (e) {
			console.error('[FileBrowser] Failed to list Windows drives:', e);
			// Fallback: return empty array or common drives
			return [
				{ name: 'C:', path: 'C:', isDirectory: true, size: 0, modified: null, permissions: null },
				{ name: 'D:', path: 'D:', isDirectory: true, size: 0, modified: null, permissions: null }
			];
		}
	}

	const { readDir } = await import('@tauri-apps/plugin-fs');

	try {
		// Platform-specific path separator
		const pathSep = isWin ? '\\' : '/';

		// Normalize path for Windows drives - ensure trailing separator for drive roots
		let normalizedPath = path;
		if (isWin && /^[A-Za-z]:$/.test(path)) {
			normalizedPath = `${path}${pathSep}`;
		}

		const entries = await readDir(normalizedPath);
		const files = [];

		for (const entry of entries) {
			try {
				// Build full path with platform-appropriate separator
				const fullPath =
					normalizedPath.endsWith('/') || normalizedPath.endsWith('\\')
						? `${normalizedPath}${entry.name}`
						: `${normalizedPath}${pathSep}${entry.name}`;

				// Use custom command for symlink detection
				const info = await invoke('get_local_file_info', { path: fullPath });

				// Normalize path for display (use forward slashes for consistency)
				const displayPath = fullPath.replace(/\\/g, '/');

				files.push({
					name: entry.name,
					path: displayPath,
					isDirectory: info.isDirectory,
					isSymlink: info.isSymlink || false,
					symlinkTarget: info.symlinkTarget || null,
					size: info.size || 0,
					modified: info.modified ? info.modified.toString() : null,
					permissions: info.permissions || null
				});
			} catch (e) {
				// Skip files we can't stat
				console.warn(`[FileBrowser] Failed to stat ${entry.name}:`, e);
			}
		}

		return files;
	} catch (e) {
		console.error(`[FileBrowser] Failed to read directory ${normalizedPath}:`, e);
		throw e;
	}
}

/**
 * Delete local file or directory
 * @param {string} path - Path to delete
 * @param {boolean} isDirectory - Whether it's a directory
 */
export async function deleteLocalPath(path, isDirectory) {
	const { remove, removeDir } = await import('@tauri-apps/plugin-fs');

	if (isDirectory) {
		await removeDir(path, { recursive: true });
	} else {
		await remove(path);
	}
}

/**
 * Create local directory
 * @param {string} path - Directory path to create
 */
export async function createLocalDirectory(path) {
	const { createDir } = await import('@tauri-apps/plugin-fs');
	await createDir(path, { recursive: true });
}

// ============== File Operations ==============

/**
 * Download file from remote to local
 * @param {string} sessionId - Session ID
 * @param {string} remotePath - Remote file path
 * @param {string} localPath - Local destination path
 * @param {string} transferId - Unique transfer ID from frontend
 */
export async function downloadFile(sessionId, remotePath, localPath, transferId) {
	return await invoke('download_file', { sessionId, remotePath, localPath, transferId });
}

/**
 * Upload file from local to remote
 * @param {string} sessionId - Session ID
 * @param {string} localPath - Local file path
 * @param {string} remotePath - Remote destination path
 * @param {string} transferId - Unique transfer ID from frontend
 */
export async function uploadFile(sessionId, localPath, remotePath, transferId) {
	return await invoke('upload_file', { sessionId, localPath, remotePath, transferId });
}

/**
 * Create directory on remote
 * @param {string} sessionId - Session ID
 * @param {string} path - Directory path to create
 */
export async function createRemoteDirectory(sessionId, path) {
	return await invoke('create_remote_directory', { sessionId, path });
}

/**
 * Delete file or directory on remote
 * @param {string} sessionId - Session ID
 * @param {string} path - Path to delete
 * @param {boolean} isDirectory - Whether it's a directory
 */
export async function deleteRemotePath(sessionId, path, isDirectory) {
	return await invoke('delete_remote_path', { sessionId, path, isDirectory });
}

/**
 * Rename file or directory on remote
 * @param {string} sessionId - Session ID
 * @param {string} oldPath - Current path
 * @param {string} newPath - New path
 */
export async function renameRemotePath(sessionId, oldPath, newPath) {
	return await invoke('rename_remote_path', { sessionId, oldPath, newPath });
}

/**
 * Rename file or directory locally
 * @param {string} oldPath - Current path
 * @param {string} newPath - New path
 */
export async function renameLocalPath(oldPath, newPath) {
	return await invoke('rename_local_path', { oldPath, newPath });
}

/**
 * Get file stat/info (local)
 * @param {string} path - File path
 * @returns {Promise<Object>} File stat info
 */
export async function getLocalFileStat(path) {
	return await invoke('get_local_file_stat', { path });
}

/**
 * Get file stat/info (remote)
 * @param {string} sessionId - Session ID
 * @param {string} path - File path
 * @returns {Promise<Object>} File stat info
 */
export async function getRemoteFileStat(sessionId, path) {
	return await invoke('get_remote_file_stat', { sessionId, path });
}

/**
 * Open file with system default app (local only)
 */
export async function openFileWithSystem(path) {
	return await invoke('open_file_with_system', { path });
}

/**
 * Show file in system file manager (local only)
 */
export async function showInFileManager(path) {
	return await invoke('show_in_file_manager', { path });
}

/**
 * Open file with specific application
 * @param {string} path - File path
 * @param {string|null} appPath - Application path (optional, uses preference if not provided)
 */
export async function openFileWithApp(path, appPath = null) {
	return await invoke('open_file_with_app', { path, appPath });
}

/**
 * Show "Open with" dialog to select application
 * @param {string} path - File path
 * @returns {Promise<string|null>} Selected app path (if any)
 */
export async function showOpenWithDialog(path) {
	// Note: AppHandle is automatically injected by Tauri
	return await invoke('show_open_with_dialog', { path });
}

/**
 * Change file permissions (SFTP only)
 */
export async function chmodRemote(sessionId, path, mode) {
	return await invoke('chmod_remote', { sessionId, path, mode });
}

/**
 * Read file content for editing (small files)
 */
export async function readFileContent(sessionId, path, isLocal) {
	return await invoke('read_file_content', { sessionId, path, isLocal });
}

/**
 * Write file content after editing
 */
export async function writeFileContent(sessionId, path, content, isLocal) {
	return await invoke('write_file_content', { sessionId, path, content, isLocal });
}

// ============== Helper Functions ==============

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}

/**
 * Get file extension
 * @param {string} filename - File name
 * @returns {string} Extension without dot
 */
export function getFileExtension(filename) {
	const parts = filename.split('.');
	return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Check if path is absolute
 * @param {string} path - Path to check
 * @returns {boolean}
 */
export function isAbsolutePath(path) {
	// Unix absolute path
	if (path.startsWith('/')) return true;
	// Windows absolute path (C:\, D:\, etc.)
	if (/^[A-Za-z]:[\\/]/.test(path)) return true;
	return false;
}

/**
 * Join path segments
 * @param {...string} segments - Path segments
 * @returns {string} Joined path
 */
export function joinPath(...segments) {
	return segments.filter(Boolean).join('/').replace(/\/+/g, '/');
}

/**
 * Check if path is Windows path (starts with drive letter)
 * @param {string} path - Path to check
 * @returns {boolean}
 */
export function isWindowsPath(path) {
	return /^[A-Za-z]:/.test(path);
}

/**
 * Get parent directory path
 * Handles both Unix and Windows paths correctly
 * @param {string} path - Current path
 * @returns {string|null} Parent path, or null if at root
 */
export function getParentPath(path) {
	if (!path) return null;

	// Normalize separators to /
	const normalizedPath = path.replace(/\\/g, '/');
	const parts = normalizedPath.split('/').filter(Boolean);

	if (parts.length === 0) {
		return null; // Already at root
	}

	// Check if this is a Windows path (e.g., C:/Users)
	const isWinPath = isWindowsPath(parts[0]);

	if (isWinPath) {
		// Windows path
		if (parts.length === 1) {
			// At drive root (e.g., C:) - can't go up
			return null;
		}
		parts.pop();
		return parts.join('/');
	} else {
		// Unix path
		if (parts.length === 1) {
			// At root (e.g., /home) - go to /
			return '/';
		}
		parts.pop();
		return '/' + parts.join('/');
	}
}

// ============== File Service Object ==============

/**
 * Create a file service instance for use with FilePanel
 * @param {string} [sessionId] - Optional session ID for remote operations
 * @param {boolean} [isLocal] - Whether this is a local file service
 * @returns {Object} File service object
 */
export function createFileService(sessionId = null, isLocal = false) {
	return {
		sessionId,
		isLocal,
		getParentPath,
		isWindowsPath,

		async listLocalDirectory(path) {
			return listLocalDirectory(path);
		},

		async listRemoteDirectory(sid, path) {
			if (!sessionId && !sid) {
				throw new Error('No session ID provided');
			}
			return listRemoteDirectory(sid || sessionId, path);
		},

		async downloadFile(remotePath, localPath, transferId = null) {
			if (!sessionId) {
				throw new Error('No session ID provided');
			}
			// Generate transferId if not provided (for backward compatibility)
			const finalTransferId = transferId || crypto.randomUUID();
			return downloadFile(sessionId, remotePath, localPath, finalTransferId);
		},

		async uploadFile(localPath, remotePath, transferId = null) {
			if (!sessionId) {
				throw new Error('No session ID provided');
			}
			// Generate transferId if not provided (for backward compatibility)
			const finalTransferId = transferId || crypto.randomUUID();
			return uploadFile(sessionId, localPath, remotePath, finalTransferId);
		},

		async createDirectory(path, isLocalDir = false) {
			if (isLocalDir || isLocal) {
				return createLocalDirectory(path);
			}
			if (!sessionId) {
				throw new Error('No session ID provided');
			}
			return createRemoteDirectory(sessionId, path);
		},

		async delete(path, isDirectory, isLocalPath = false) {
			if (isLocalPath || isLocal) {
				return deleteLocalPath(path, isDirectory);
			}
			if (!sessionId) {
				throw new Error('No session ID provided');
			}
			return deleteRemotePath(sessionId, path, isDirectory);
		},

		async rename(oldPath, newPath) {
			if (!sessionId) {
				throw new Error('No session ID provided');
			}
			return renameRemotePath(sessionId, oldPath, newPath);
		}
	};
}
