/**
 * File Browser Utilities
 * Consolidated from multiple file-browser utilities
 */

/**
 * Generate context menu items for file browser
 * Separated from components for reusability
 */
import * as LucideIcons from 'lucide-svelte';
import { keyboardShortcutManager } from '$lib/services';

const maxEditFileSize = 1024 * 3000; // 3MB

// Helper to get shortcut from settings
function getShortcut(actionName, defaultValue) {
	return keyboardShortcutManager.getShortcut(actionName) || defaultValue;
}

/**
 * Generate file context menu items
 */
export function getFileMenuItems(file, options = {}) {
	const {
		selectedFiles = [],
		type = 'local',
		hasHost = false,
		enableSsh = true,
		canPaste = false
	} = options;

	if (!file) return [];

	const isFtp = type === 'ftp';
	const isLocal = type === 'local';
	const isRemote = type === 'sftp' || type === 'ftp';
	const isWin = typeof window !== 'undefined' && navigator.platform.includes('Win');

	const isDirectory = file.isDirectory;
	const isRealFile = file.path && file.name !== '..';
	const isSmallFile = !isDirectory && file.size < maxEditFileSize;
	const multiSelect = selectedFiles.length > 1;
	const isSelected = selectedFiles.some(f => f.path === file.path);

	const items = [];

	// === NAVIGATION GROUP ===
	if (isDirectory && isRealFile) {
		items.push({
			id: 'enter',
			icon: LucideIcons.LogIn,
			label: 'Enter'
		});
	}

	// === TRANSFER GROUP ===
	if (multiSelect && isSelected && hasHost) {
		items.push({
			id: 'transferSelected',
			icon: isLocal ? LucideIcons.Upload : LucideIcons.Download,
			label: `Transfer Selected (${selectedFiles.length})`
		});
	}

	// Go to folder in terminal
	if (isDirectory && ((hasHost && enableSsh && !isFtp && isRemote) || (isLocal && !hasHost))) {
		items.push({
			id: 'gotoTerminal',
			icon: LucideIcons.Terminal,
			label: 'Go to Terminal'
		});
	}

	if (!multiSelect && isRealFile) {
		if (isLocal) {
			// Local -> Remote: Upload (will error gracefully if no remote session)
			items.push({
				id: 'upload',
				icon: LucideIcons.Upload,
				label: 'Upload'
			});
		} else if (hasHost) {
			// Remote -> Local: Download
			items.push({
				id: 'transfer',
				icon: LucideIcons.Download,
				label: 'Download'
			});
		}

		if (isDirectory && !isFtp && hasHost) {
			items.push({
				id: 'zipTransfer',
				icon: LucideIcons.Archive,
				label: 'Compress & Transfer'
			});
		}
	}

	// Separator after transfer group
	if (
		(hasHost && isRealFile) ||
		(isDirectory && ((hasHost && enableSsh && !isFtp && isRemote) || (isLocal && !hasHost)))
	) {
		items.push({ id: 'separator' });
	}

	// === OPEN/EDIT GROUP ===
	const hasOpenOptions = !isDirectory && isRealFile && (isLocal || isRemote);

	if (hasOpenOptions) {
		items.push({
			id: 'open',
			icon: LucideIcons.ExternalLink,
			label: 'Open'
		});
		items.push({
			id: 'openWith',
			icon: LucideIcons.FileEdit,
			label: 'Open With...'
		});
	}

	if (isSmallFile && isRealFile && !isDirectory) {
		items.push({
			id: 'edit',
			icon: LucideIcons.Edit,
			label: 'Edit'
		});
	}

	// Separator after open/edit
	if (hasOpenOptions || (isSmallFile && isRealFile && !isDirectory)) {
		items.push({ id: 'separator' });
	}

	// === COPY/CUT/PASTE GROUP ===
	if (isRealFile) {
		items.push({
			id: 'copy',
			icon: LucideIcons.Copy,
			label: 'Copy',
			shortcut: getShortcut('copyFile', 'Ctrl+Shift+C')
		});
		items.push({
			id: 'cut',
			icon: LucideIcons.Scissors,
			label: 'Cut',
			shortcut: getShortcut('cutFile', 'Ctrl+Shift+X')
		});
	}

	if (canPaste) {
		items.push({
			id: 'paste',
			icon: LucideIcons.Clipboard,
			label: 'Paste',
			shortcut: getShortcut('pasteFile', 'Ctrl+Shift+V'),
			disabled: !canPaste
		});
	}

	// Separator after copy/cut/paste
	if (isRealFile || canPaste) {
		items.push({ id: 'separator' });
	}

	// === RENAME/DELETE GROUP ===
	if (isRealFile) {
		items.push({
			id: 'rename',
			icon: LucideIcons.Edit3,
			label: 'Rename',
			shortcut: getShortcut('renameFile', 'F2')
		});
		items.push({
			id: 'delete',
			icon: LucideIcons.Trash2,
			label: 'Delete',
			shortcut: getShortcut('deleteFile', 'Delete'),
			danger: true
		});
	}

	// Separator before selection
	items.push({ id: 'separator' });

	// === SELECTION GROUP ===
	items.push({
		id: 'selectAll',
		icon: LucideIcons.CheckSquare,
		label: 'Select All',
		shortcut: getShortcut('selectAllFiles', 'Ctrl+Shift+A')
	});

	items.push({
		id: 'refresh',
		icon: LucideIcons.RefreshCw,
		label: 'Refresh',
		shortcut: getShortcut('refreshFileList', 'F5')
	});

	// Separator before permissions/info
	items.push({ id: 'separator' });

	// === PERMISSIONS/INFO GROUP ===
	if (isRealFile && isRemote) {
		if (isFtp) {
			items.push({
				id: 'permissions',
				icon: LucideIcons.Lock,
				label: 'View Permissions'
			});
		} else {
			items.push({
				id: 'permissions',
				icon: LucideIcons.Lock,
				label: 'Edit Permissions'
			});
		}
	}

	if (isRealFile) {
		items.push({
			id: 'info',
			icon: LucideIcons.Info,
			label: 'Properties'
		});
	}

	return items;
}

/**
 * Generate empty area context menu items
 */
export function getEmptyAreaMenuItems(options = {}) {
	const { canPaste = false } = options;
	const items = [];

	items.push({
		id: 'newFile',
		icon: LucideIcons.FilePlus,
		label: 'New File'
	});

	items.push({
		id: 'newFolder',
		icon: LucideIcons.FolderPlus,
		label: 'New Folder'
	});

	items.push({ id: 'separator' });

	if (canPaste) {
		items.push({
			id: 'paste',
			icon: LucideIcons.Clipboard,
			label: 'Paste',
			disabled: !canPaste
		});
	}

	items.push({ id: 'separator' });

	items.push({
		id: 'selectAll',
		icon: LucideIcons.CheckSquare,
		label: 'Select All',
		shortcut: getShortcut('selectAllFiles', 'Ctrl+Shift+A')
	});

	items.push({
		id: 'refresh',
		icon: LucideIcons.RefreshCw,
		label: 'Refresh',
		shortcut: getShortcut('refreshFileList', 'F5')
	});

	return items;
}

// ================== FILE ACTIONS ==================
/**
 * File action handlers
 * Separated from FilePanel for reusability
 */

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

// ================== FILE OPERATIONS ==================
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

// ================== NAVIGATION ==================
/**
 * Navigation handlers
 * Separated from FilePanel for reusability
 */

import { getParentPath, isWindowsPath } from '$lib/services';
import { isWin } from './paths.js';

/**
 * Navigate to a file/directory
 */
export function handleNavigateFile(file, currentPath, navigateTo) {
	const oldPath = currentPath;

	if (file.name === '..') {
		const parentPath = getParentPath(currentPath);
		// If at Windows drive root (e.g., E:/), go to / to list drives
		if (
			!parentPath &&
			isWin &&
			isWindowsPath(currentPath) &&
			/^[A-Za-z]:[\\/]?$/.test(currentPath)
		) {
			navigateTo('/', oldPath);
		} else if (parentPath && parentPath !== currentPath) {
			navigateTo(parentPath, oldPath);
		}
	} else if (file.isDirectory) {
		let targetPath = file.path;
		if (isWin && /^[A-Za-z]:$/.test(file.path)) {
			targetPath = `${file.path}\\`;
		}
		navigateTo(targetPath, oldPath);
	}
}

/**
 * Navigate to parent directory
 */
export function handleGoToParent(currentPath, navigateTo) {
	const oldPath = currentPath;
	const parentPath = getParentPath(currentPath);
	// If at Windows drive root (e.g., E:/), go to / to list drives
	if (!parentPath && isWin && isWindowsPath(currentPath) && /^[A-Za-z]:[\\/]?$/.test(currentPath)) {
		navigateTo('/', oldPath);
	} else if (parentPath && parentPath !== currentPath) {
		navigateTo(parentPath, oldPath);
	}
}

/**
 * Navigate to home directory
 */
export function handleGoToHome(homeDirectory, type, currentPath, navigateTo) {
	const oldPath = currentPath;

	// Local: go to OS/homePath (if available)
	// Remote (SFTP/FTP): go to remote home/root (homeDirectory is set from initialPath/homePath)
	let targetPath = null;
	if (type === 'local') {
		targetPath = homeDirectory || null;
	} else {
		targetPath = homeDirectory || '/';
	}

	if (targetPath) {
		navigateTo(targetPath, oldPath);
	}
}

/**
 * Navigate to a specific path
 */
export function handlePathNavigation(newPath, currentPath, navigateTo) {
	if (!newPath || !newPath.trim()) {
		return;
	}

	const trimmedPath = newPath.trim();
	const oldPath = currentPath;

	// Normalize Windows drive paths (C: -> C:\)
	let normalizedPath = trimmedPath;
	if (isWin && /^[A-Za-z]:$/.test(trimmedPath)) {
		normalizedPath = `${trimmedPath}\\`;
	}

	navigateTo(normalizedPath, oldPath);
}

/**
 * Navigate back in history
 */
export function handleNavigateBack(
	history,
	historyIndex,
	setCurrentPath,
	setHistoryIndex,
	setSelectedIds
) {
	if (historyIndex > 0) {
		const newIndex = historyIndex - 1;
		const newPath = history[newIndex];
		if (newPath) {
			setCurrentPath(newPath);
			setHistoryIndex(newIndex);
			setSelectedIds([]);
		}
	}
}

/**
 * Navigate forward in history
 */
export function handleNavigateForward(
	history,
	historyIndex,
	setCurrentPath,
	setHistoryIndex,
	setSelectedIds
) {
	if (historyIndex < history.length - 1) {
		const newIndex = historyIndex + 1;
		const newPath = history[newIndex];
		if (newPath) {
			setCurrentPath(newPath);
			setHistoryIndex(newIndex);
			setSelectedIds([]);
		}
	}
}
/**
 * File navigation utilities
 */

/**
 * Navigate to a new path and update history
 */
export function navigateToPath(
	path,
	oldPath,
	currentHistory,
	currentHistoryIndex,
	maxPathHistory = 20
) {
	if (path === oldPath) {
		return {
			history: currentHistory,
			historyIndex: currentHistoryIndex,
			pathHistory: []
		};
	}

	// Add to history
	const newHistory = currentHistory.slice(0, currentHistoryIndex + 1);
	newHistory.push(path);
	const newHistoryIndex = newHistory.length - 1;

	// Add to path history (for AddressBar dropdown)
	let newPathHistory = [];
	if (oldPath && oldPath !== path) {
		newPathHistory = [oldPath, ...currentHistory].filter(p => p !== path).slice(0, maxPathHistory);
	}

	return {
		history: newHistory,
		historyIndex: newHistoryIndex,
		pathHistory: newPathHistory
	};
}

// ================== SELECTION ==================
/**
 * File selection utilities
 */

/**
 * Handle file selection with Ctrl/Cmd and Shift support
 */
export function handleFileSelection(file, event, selectedIds, displayFiles) {
	if (file.name === '..') {
		return [];
	}

	if (event.ctrlKey || event.metaKey) {
		// Toggle selection
		if (selectedIds.includes(file.path)) {
			return selectedIds.filter(id => id !== file.path);
		} else {
			return [...selectedIds, file.path];
		}
	} else if (event.shiftKey && selectedIds.length > 0) {
		// Range selection
		const lastSelected = selectedIds[selectedIds.length - 1];
		const lastIndex = displayFiles.findIndex(f => f.path === lastSelected);
		const currentIndex = displayFiles.findIndex(f => f.path === file.path);

		const start = Math.min(lastIndex, currentIndex);
		const end = Math.max(lastIndex, currentIndex);

		const range = displayFiles
			.slice(start, end + 1)
			.filter(f => f.name !== '..')
			.map(f => f.path);

		return [...new Set([...selectedIds, ...range])];
	} else {
		// Single selection
		return [file.path];
	}
}

// ================== SORTING ==================
/**
 * File sorting utilities
 */

/**
 * Sort files array
 */
export function sortFiles(files, sortBy, sortOrder) {
	return [...files].sort((a, b) => {
		// Handle null/undefined files
		if (!a || !b) return 0;
		if (!a.name && !b.name) return 0;
		if (!a.name) return 1;
		if (!b.name) return -1;

		// Directories first
		if (a.isDirectory !== b.isDirectory) {
			return a.isDirectory ? -1 : 1;
		}

		let cmp = 0;
		switch (sortBy) {
			case 'name':
				cmp = (a.name || '').localeCompare(b.name || '');
				break;
			case 'modified':
				cmp = (a.modified || '').localeCompare(b.modified || '');
				break;
			case 'size':
				cmp = (a.size || 0) - (b.size || 0);
				break;
			case 'kind':
				const aExt = a.name ? a.name.split('.').pop() || '' : '';
				const bExt = b.name ? b.name.split('.').pop() || '' : '';
				cmp = aExt.localeCompare(bExt);
				break;
		}

		return sortOrder === 'asc' ? cmp : -cmp;
	});
}

/**
 * Filter files by hidden and keyword
 */
export function filterFiles(files, options = {}) {
	const { showHidden = false, keyword = '', filterText = '' } = options;

	let result = [...files];

	// Filter out invalid files (missing name property)
	result = result.filter(f => f && f.name != null);

	// Filter hidden files
	if (!showHidden) {
		result = result.filter(f => !f.name.startsWith('.'));
	}

	// Filter by keyword (from AddressBar)
	if (keyword) {
		const lower = keyword.toLowerCase();
		result = result.filter(f => f.name.toLowerCase().includes(lower));
	}

	// Filter by text (from header)
	if (filterText) {
		const lower = filterText.toLowerCase();
		result = result.filter(f => f.name.toLowerCase().includes(lower));
	}

	return result;
}

// ================== OPEN HANDLERS ==================
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
			await import('$lib/services');
		const { getAppPreference, getFileExtension, setAppPreference } =
			await import('$lib/services');

		let filePath = file.path;

		// For remote files, download to temp first
		if (type !== 'local' && sessionId) {
			const { downloadFile } = await import('$lib/services');
			const { createTempFilePath, registerTempFile, startWatching } =
				await import('$lib/services');

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
		const { openFileWithApp, showOpenWithDialog } = await import('$lib/services');
		const { getFileExtension, setAppPreference } =
			await import('$lib/services');

		let filePath = file.path;

		// For remote files, download to temp first
		if (type !== 'local' && sessionId) {
			const { downloadFile } = await import('$lib/services');
			const { createTempFilePath, registerTempFile, startWatching } =
				await import('$lib/services');

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

// ================== RENAME ==================
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
