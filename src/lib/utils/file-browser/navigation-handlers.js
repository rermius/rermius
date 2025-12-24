/**
 * Navigation handlers
 * Separated from FilePanel for reusability
 */

import { getParentPath, isWindowsPath } from '$lib/services/file-browser';
import { isWin } from '$lib/utils/path/file-utils';

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
