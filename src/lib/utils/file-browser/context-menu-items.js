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
