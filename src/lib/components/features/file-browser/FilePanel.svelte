<script>
	import FilePanelHeader from './FilePanelHeader.svelte';
	import AddressBar from './AddressBar.svelte';
	import FileListHeader from './FileListHeader.svelte';
	import FileList from './FileList.svelte';
	import FilePropertiesModal from './FilePropertiesModal.svelte';
	import FilePermissionsModal from './FilePermissionsModal.svelte';
	import InputNameModal from './InputNameModal.svelte';
	import DeleteConfirmModal from './DeleteConfirmModal.svelte';
	import { fileClipboardStore } from '$lib/stores/file-clipboard.store';
	import {
		getHomeDirectory,
		getParentPath,
		isWindowsPath,
		getLocalFileStat,
		getRemoteFileStat,
		copyLocalPath,
		moveLocalPath,
		copyRemotePath,
		moveRemotePath,
		uploadFile,
		downloadFile
	} from '$lib/services';
	import {
		resolve,
		isWin,
		sortFiles,
		filterFiles,
		handleCreateFile,
		handleCreateFolder,
		handleDeleteFiles,
		handleOpenFile,
		handleOpenWithFile,
		handleRenameFile,
		handleNavigateFile,
		handleGoToParent,
		handleGoToHome,
		handlePathNavigation
	} from '$lib/utils';

	const {
		// Session info
		sessionId = null,
		type = 'local', // 'local' | 'sftp' | 'ftp'
		title = 'Files',

		// Initial state
		initialPath = '/',
		homePath = null, // Home directory path (for local, prevents going above home)

		// Callbacks
		onFileSelect,
		onTransferRequest,
		onPathChange,

		// File service (injected)
		fileService = null
	} = $props();

	// Determine context menu flags
	const hasHost = $derived(!!sessionId); // Has remote connection
	const enableSsh = $derived(type === 'sftp'); // SSH enabled for terminal access

	// State
	let currentPath = $state('');
	let files = $state([]);
	let selectedIds = $state([]);
	let loading = $state(false);
	let error = $state(null);

	// Sort state
	let sortBy = $state('name');
	let sortOrder = $state('asc');

	// Filter
	const filterText = $state('');
	let keyword = $state('');
	let showHidden = $state(false);

	// History for back/forward
	let history = $state([]);
	let historyIndex = $state(0);

	// Path history (for AddressBar dropdown)
	let pathHistory = $state([]);
	const maxPathHistory = 20;

	// AddressBar state
	let pathTemp = $state('');
	let inputFocus = $state(false);
	let homeDirectory = $state('');

	// Track last loaded path to prevent duplicate loads
	let lastLoadedPath = $state('');
	// Track if we've already resolved the initial remote home directory
	let resolvedInitialRemoteHome = $state(false);

	// Properties modal state
	let showPropertiesModal = $state(false);
	let propertiesFile = $state(null);
	let propertiesData = $state(null);
	let loadingProperties = $state(false);

	// Permissions modal state
	let showPermissionsModal = $state(false);
	let permissionsFile = $state(null);

	// Input name modal state
	let showInputNameModal = $state(false);
	let inputNameModalType = $state('file'); // 'file' | 'folder'
	let inputNameModalCallback = $state(null);
	let inputNameModalRef = $state(null);

	// Delete confirm modal state
	let showDeleteConfirmModal = $state(false);
	let filesToDelete = $state([]);
	let deleting = $state(false);

	// Track rename operations to prevent duplicates
	const renameInProgress = $state(new Set());

	// Track which file should start editing (for F2 keyboard shortcut)
	let fileToRename = $state(null);

	// Pagination state
	let currentPage = $state(1);
	const pageSize = 100; // Constant

	// Listen for permissions changed event
	$effect(() => {
		function handlePermissionsChanged(event) {
			const { filePath, sessionId: eventSessionId, type: eventType } = event.detail || {};

			// Only reload if this event is for this panel
			// Check by sessionId (for remote) or type (for local)
			const isForThisPanel =
				(type === 'local' && eventType === 'local') ||
				(type !== 'local' && eventSessionId === sessionId) ||
				(type !== 'local' && eventType === type);

			if (!isForThisPanel) {
				return;
			}

			// Reload file list to get updated permissions from server
			// This ensures we have the actual permissions as set by the server
			loadFiles(currentPath)
				.then(() => {
					// Select the file that was modified if it still exists
					if (filePath) {
						const updatedFile = files.find(f => f.path === filePath);
						if (updatedFile) {
							selectedIds = [filePath];
						}
					}
				})
				.catch(e => {
					console.error('[FilePanel] Failed to reload files after permissions change:', e);
				});
		}
		window.addEventListener('file-permissions-changed', handlePermissionsChanged);
		return () => {
			window.removeEventListener('file-permissions-changed', handlePermissionsChanged);
		};
	});

	// Initialize from initialPath prop (only once on mount)
	let isInitialized = $state(false);
	$effect(async () => {
		if (!isInitialized && initialPath) {
			currentPath = initialPath;
			pathTemp = initialPath;
			history = [initialPath];
			historyIndex = 0;
			lastLoadedPath = '';

			// Set home directory:
			// - Local panel: use OS home (or explicit homePath if provided)
			// - Remote panel (SFTP/FTP): use provided homePath or initialPath (remote home/root)
			if (type === 'local') {
				try {
					homeDirectory = homePath || (await getHomeDirectory());
				} catch (e) {
					console.error('[FilePanel] Failed to get home directory:', e);
				}
			} else {
				homeDirectory = homePath || initialPath || '/';
			}

			isInitialized = true;
		}
	});

	// Sync pathTemp with currentPath (only when input is not focused)
	$effect(() => {
		if (currentPath && currentPath !== pathTemp && !inputFocus) {
			pathTemp = currentPath;
		}
	});

	// Filtered and sorted files (all files after filter/sort)
	const displayFiles = $derived(() => {
		const filtered = filterFiles(files, { showHidden, keyword, filterText });
		return sortFiles(filtered, sortBy, sortOrder);
	});

	// Paginated files (slice of displayFiles for current page)
	const paginatedFiles = $derived(() => {
		const start = (currentPage - 1) * pageSize;
		const end = start + pageSize;
		return displayFiles().slice(start, end);
	});

	// Pagination info
	const totalPages = $derived(Math.ceil(displayFiles().length / pageSize));
	const totalFiles = $derived(displayFiles().length); // Total after filter
	const startIndex = $derived((currentPage - 1) * pageSize);
	const endIndex = $derived(Math.min(startIndex + pageSize, totalFiles));

	// Reset page to 1 when filter/sort/path changes
	let prevDisplayFilesLength = $state(0);
	$effect(() => {
		const currentLength = displayFiles().length;
		if (currentLength !== prevDisplayFilesLength) {
			currentPage = 1;
			prevDisplayFilesLength = currentLength;
		}
	});

	// Reset page when path changes
	$effect(() => {
		if (currentPath) {
			currentPage = 1;
		}
	});

	const canGoBack = $derived(historyIndex > 0);
	const canGoForward = $derived(historyIndex < history.length - 1);

	// Load files when path changes
	$effect(() => {
		if (currentPath && currentPath !== lastLoadedPath) {
			lastLoadedPath = currentPath;
			loadFiles(currentPath);
		}
	});

	async function loadFiles(path) {
		if (!path) return;

		if (!fileService) {
			files = getMockFiles(path);
			return;
		}

		loading = true;
		error = null;

		try {
			let loadedFiles = [];
			if (type === 'local') {
				loadedFiles = await fileService.listLocalDirectory(path);
			} else if (sessionId) {
				loadedFiles = await fileService.listRemoteDirectory(sessionId, path);
			} else {
				throw new Error('No session ID provided for remote connection');
			}

			// Remove duplicates by path to prevent each_key_duplicate error
			const uniqueFiles = [];
			const seenPaths = new Set();
			for (const file of loadedFiles) {
				if (!seenPaths.has(file.path)) {
					seenPaths.add(file.path);
					uniqueFiles.push(file);
				}
			}
			files = uniqueFiles;

			// Sync UI path with backend's actual directory on first load for remote connections
			// Backend resolves "/" to home directory (e.g., "/www") on first request only
			if (
				!resolvedInitialRemoteHome &&
				type !== 'local' &&
				(path === '/' || path === '') &&
				uniqueFiles.length > 0
			) {
				const first = uniqueFiles[0];
				if (first.path) {
					const normalized = first.path.replace(/\\/g, '/');
					const lastSlash = normalized.lastIndexOf('/');
					if (lastSlash > 0) {
						const actualDir = normalized.substring(0, lastSlash);
						if (actualDir && actualDir !== currentPath) {
							currentPath = actualDir;
							pathTemp = actualDir;
							homeDirectory = actualDir;
							onPathChange?.(actualDir);
						}
						resolvedInitialRemoteHome = true;
					}
				}
			}
		} catch (e) {
			const errorMsg = e?.message || e?.toString() || String(e) || 'Unknown error';
			error = errorMsg || 'Failed to load directory';
			files = [];
		} finally {
			loading = false;
		}
	}

	function getMockFiles(path) {
		// Mock data for development
		return [
			{
				name: 'Documents',
				path: `${path}/Documents`,
				isDirectory: true,
				modified: '1734500000',
				size: 0
			},
			{
				name: 'Downloads',
				path: `${path}/Downloads`,
				isDirectory: true,
				modified: '1734400000',
				size: 0
			},
			{
				name: 'config.json',
				path: `${path}/config.json`,
				isDirectory: false,
				modified: '1734300000',
				size: 1024,
				permissions: '-rw-r--r--'
			},
			{
				name: 'readme.md',
				path: `${path}/readme.md`,
				isDirectory: false,
				modified: '1734200000',
				size: 2048,
				permissions: '-rw-r--r--'
			},
			{
				name: 'script.sh',
				path: `${path}/script.sh`,
				isDirectory: false,
				modified: '1734100000',
				size: 512,
				permissions: '-rwxr-xr-x'
			}
		];
	}

	function navigateTo(path, oldPath = null) {
		if (currentPath === path) return;

		// Add to history
		const newHistory = history.slice(0, historyIndex + 1);
		newHistory.push(path);
		history = newHistory;
		historyIndex = newHistory.length - 1;

		// Add to path history (for AddressBar dropdown)
		if (oldPath && oldPath !== path) {
			const newPathHistory = [oldPath, ...pathHistory]
				.filter(p => p !== path)
				.slice(0, maxPathHistory);
			pathHistory = newPathHistory;
		}

		// Update current path (effect will sync pathTemp if not focused)
		currentPath = path;
		onPathChange?.(path);
		selectedIds = [];
	}

	function handleNavigate(file) {
		handleNavigateFile(file, currentPath, (path, oldPath) => navigateTo(path, oldPath));
	}

	function handleGoParent() {
		handleGoToParent(currentPath, (path, oldPath) => navigateTo(path, oldPath));
	}

	function handleGoHome() {
		handleGoToHome(homeDirectory, type, currentPath, (path, oldPath) => navigateTo(path, oldPath));
	}

	function handlePathGo(type, newPath) {
		handlePathNavigation(newPath, currentPath, (path, oldPath) => navigateTo(path, oldPath));
	}

	function handleHistorySelect(type, historyPath) {
		navigateTo(historyPath);
	}

	function handleToggleHidden(type) {
		showHidden = !showHidden;
	}

	function handleKeywordChange(newKeyword, type) {
		keyword = newKeyword;
	}

	function handleInputFocus(type) {
		inputFocus = true;
	}

	function handleInputBlur(type) {
		inputFocus = false;
	}

	function handleBack() {
		if (canGoBack && historyIndex > 0) {
			historyIndex--;
			const newPath = history[historyIndex];
			if (newPath) {
				currentPath = newPath;
				selectedIds = [];
			}
		}
	}

	function handleForward() {
		if (canGoForward && historyIndex < history.length - 1) {
			historyIndex++;
			const newPath = history[historyIndex];
			if (newPath) {
				currentPath = newPath;
				selectedIds = [];
			}
		}
	}
	function handleSort(key, order) {
		sortBy = key;
		sortOrder = order;
	}

	function handleRefresh() {
		loadFiles(currentPath);
	}

	// ============== Helper Functions (Extract complex logic) ==============

	async function createNewFile(fileName) {
		try {
			const newFile = await handleCreateFile(
				fileName,
				currentPath,
				type,
				sessionId,
				fileService,
				files
			);
			files = [...files, newFile];
			selectedIds = [newFile.path];
			if (inputNameModalRef) {
				inputNameModalRef.closeModal();
			}
		} catch (e) {
			if (inputNameModalRef) {
				inputNameModalRef.setError(e.message || `Failed to create file: ${e.message}`);
			}
		}
	}

	async function createNewFolder(folderName) {
		try {
			const newFolder = await handleCreateFolder(
				folderName,
				currentPath,
				type,
				fileService,
				sessionId,
				files
			);
			files = [...files, newFolder];
			selectedIds = [newFolder.path];
			if (inputNameModalRef) {
				inputNameModalRef.closeModal();
			}
		} catch (e) {
			if (inputNameModalRef) {
				inputNameModalRef.setError(e.message || `Failed to create folder: ${e.message}`);
			}
		}
	}

	async function handleCopyOrCut(actionId, targetFiles) {
		try {
			// Write paths to system clipboard (for compatibility)
			const paths = targetFiles.map(f => f.path).join('\n');
			await navigator.clipboard.writeText(paths);

			// Prepare clipboard items for store
			const clipboardFiles = targetFiles.map(f => ({
				path: f.path,
				name: f.name,
				isDirectory: f.isDirectory
			}));

			// Write to clipboard store
			if (actionId === 'cut') {
				fileClipboardStore.cut(clipboardFiles, type, sessionId);
			} else {
				fileClipboardStore.copy(clipboardFiles, type, sessionId);
			}
		} catch (e) {
			console.error('Failed to copy/cut:', e);
		}
	}

	// ============== Main Handler (Consolidated, No Duplicates) ==============

	async function handleFileAction(actionId, file) {
		// Block all actions during delete operation
		if (deleting) {
			return;
		}

		// Get selected files and determine target files
		const selectedFiles = files.filter(f => selectedIds.includes(f.path));
		const targetFiles =
			file && selectedFiles.length > 1 && selectedFiles.some(f => f.path === file.path)
				? selectedFiles
				: file
					? [file]
					: selectedFiles;

		// === Universal Actions (work for both empty area and files) ===

		if (actionId === 'paste') {
			await handlePaste();
			return;
		}

		if (actionId === 'refresh') {
			handleRefresh();
			return;
		}

		if (actionId === 'selectAll') {
			selectedIds = files.filter(f => f.name !== '..').map(f => f.path);
			return;
		}

		if (actionId === 'newFile') {
			inputNameModalType = 'file';
			inputNameModalCallback = createNewFile;
			showInputNameModal = true;
			return;
		}

		if (actionId === 'newFolder' || actionId === 'new-folder') {
			inputNameModalType = 'folder';
			inputNameModalCallback = createNewFolder;
			showInputNameModal = true;
			return;
		}

		if (actionId === 'delete') {
			if (targetFiles.length === 0) return;
			filesToDelete = targetFiles;
			showDeleteConfirmModal = true;
			return;
		}

		if (actionId === 'copy' || actionId === 'cut') {
			await handleCopyOrCut(actionId, targetFiles);
			return;
		}

		// === File-Specific Actions (require a file) ===

		if (!file) {
			// Action requires a file but none provided
			console.warn(`Action "${actionId}" requires a file but none was provided`);
			return;
		}

		switch (actionId) {
			case 'enter':
				if (file.isDirectory) {
					handleNavigate(file);
				}
				break;

			case 'transfer':
			case 'transferSelected':
				onTransferRequest?.('transfer', targetFiles);
				break;

			case 'upload':
				// Explicit upload from local panel context menu
				onTransferRequest?.('upload', targetFiles);
				break;

			case 'download':
				onTransferRequest?.('download', targetFiles);
				break;

			case 'zipTransfer':
				onTransferRequest?.('zipTransfer', targetFiles);
				break;

			case 'gotoTerminal':
				onTransferRequest?.('gotoTerminal', file);
				break;

			case 'open':
				try {
					await handleOpenFile(file, type, sessionId);
				} catch (e) {
					console.error('[FilePanel] Failed to open file:', e);
					const errorMsg = e?.message || e?.toString() || String(e) || 'Unknown error';
					error = `Failed to open file: ${errorMsg}`;
				}
				break;

			case 'openWith':
				try {
					await handleOpenWithFile(file, type, sessionId);
				} catch (e) {
					console.error('[FilePanel] Failed to open with:', e);
					const errorMsg = e?.message || e?.toString() || String(e) || 'Unknown error';
					error = `Failed to open with: ${errorMsg}`;
				}
				break;

			case 'showInExplorer':
				try {
					const { showInFileManager } = await import('$lib/services');
					await showInFileManager(file.path);
				} catch (e) {
					console.error('[FilePanel] Failed to show in explorer:', e);
				}
				break;

			case 'rename':
				if (file.newName) {
					try {
						const result = await handleRenameFile(
							file,
							currentPath,
							type,
							sessionId,
							renameInProgress
						);
						if (result) {
							await loadFiles(currentPath);
							selectedIds = [result.newPath];
						}
					} catch (e) {
						console.error('[FilePanel] Failed to rename:', e);
						const errorMsg = e?.message || e?.toString() || String(e) || 'Unknown error';
						error = `Failed to rename: ${errorMsg}`;
						await loadFiles(currentPath);
					}
				} else {
					// Trigger edit mode in FileRow
					if (file.path && file.name !== '..') {
						fileToRename = file.path;
						if (!selectedIds.includes(file.path)) {
							selectedIds = [file.path];
						}
						setTimeout(() => {
							fileToRename = null;
						}, 0);
					}
				}
				break;

			case 'info':
				// Show properties modal
				showPropertiesModal = true;
				propertiesFile = file;
				loadingProperties = true;
				propertiesData = null;

				(async () => {
					try {
						if (type === 'local') {
							const data = await getLocalFileStat(file.path);
							propertiesData = data;
						} else if (sessionId) {
							const data = await getRemoteFileStat(sessionId, file.path);
							propertiesData = data;
						}
					} catch (e) {
						console.error('[FilePanel] Failed to load properties:', e);
						const errorMsg = e?.message || e?.toString() || String(e) || 'Unknown error';
						error = `Failed to load properties: ${errorMsg}`;
					} finally {
						loadingProperties = false;
					}
				})();
				break;

			case 'edit':
				// TODO: Open file editor
				break;

			case 'copyPath':
				try {
					await navigator.clipboard.writeText(file.path);
				} catch (e) {
					console.error('Failed to copy path:', e);
				}
				break;

			case 'permissions':
				// Show permissions modal (only for remote files with permissions)
				if (type !== 'local' && sessionId && file.permissions) {
					showPermissionsModal = true;
					permissionsFile = file;
				}
				break;

			default:
				console.warn(`Unknown action: ${actionId}`);
		}
	}

	function handleDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}

	async function handleDrop(e, dropPath) {
		e.preventDefault();
		const fromFileData = e.dataTransfer.getData('fromFile');
		if (!fromFileData) return;

		try {
			const fromFile = JSON.parse(fromFileData);
			const targetPath = dropPath || currentPath;

			// Determine transfer direction
			const isFromRemote =
				fromFile.type === 'remote' || fromFile.type === 'sftp' || fromFile.type === 'ftp';
			const isToRemote = type !== 'local';

			if (isFromRemote !== isToRemote) {
				// Cross-pane transfer
				onTransferRequest?.('transfer', [fromFile]);
			} else {
				// Same-pane move (future)
			}
		} catch (err) {
			console.error('Failed to handle drop:', err);
		}
	}

	// Notify parent of selection changes
	$effect(() => {
		const selectedFiles = files.filter(f => selectedIds.includes(f.path));
		onFileSelect?.(selectedFiles);
	});

	// File browser shortcut event listeners
	$effect(() => {
		const handleCopyFile = () => {
			// Only handle if FilePanel is in focus
			if (!document.activeElement?.closest('.file-panel')) return;

			const selectedFiles = files.filter(f => selectedIds.includes(f.path));
			if (selectedFiles.length > 0) {
				handleFileAction('copy', selectedFiles[0]);
			}
		};

		const handleCutFile = () => {
			// Only handle if FilePanel is in focus
			if (!document.activeElement?.closest('.file-panel')) return;

			const selectedFiles = files.filter(f => selectedIds.includes(f.path));
			if (selectedFiles.length > 0) {
				handleFileAction('cut', selectedFiles[0]);
			}
		};

		const handlePasteFile = () => {
			// Only handle if FilePanel is in focus
			if (!document.activeElement?.closest('.file-panel')) return;

			handleFileAction('paste', null);
		};

		const handleSelectAllFiles = () => {
			// Only handle if FilePanel is in focus
			if (!document.activeElement?.closest('.file-panel')) return;

			selectedIds = files.map(f => f.path);
		};

		const handleDeleteFile = () => {
			// Only handle if FilePanel is in focus
			if (!document.activeElement?.closest('.file-panel')) return;

			handleAction('delete');
		};

		const handleRenameFile = () => {
			// Only handle if FilePanel is in focus
			if (!document.activeElement?.closest('.file-panel')) return;

			const selectedFiles = files.filter(f => selectedIds.includes(f.path));
			if (selectedFiles.length === 1 && selectedFiles[0].path && selectedFiles[0].name !== '..') {
				// Set fileToRename to trigger edit mode in FileRow
				fileToRename = selectedFiles[0].path;
				// Reset after a tick to allow FileRow to react
				setTimeout(() => {
					fileToRename = null;
				}, 0);
			}
		};

		const handleRefreshFileList = () => {
			// Only handle if FilePanel is in focus
			if (!document.activeElement?.closest('.file-panel')) return;

			handleRefresh();
		};

		// Register event listeners
		window.addEventListener('app:copy-file', handleCopyFile);
		window.addEventListener('app:cut-file', handleCutFile);
		window.addEventListener('app:paste-file', handlePasteFile);
		window.addEventListener('app:select-all-files', handleSelectAllFiles);
		window.addEventListener('app:delete-file', handleDeleteFile);
		window.addEventListener('app:rename-file', handleRenameFile);
		window.addEventListener('app:refresh-file-list', handleRefreshFileList);

		return () => {
			// Cleanup
			window.removeEventListener('app:copy-file', handleCopyFile);
			window.removeEventListener('app:cut-file', handleCutFile);
			window.removeEventListener('app:paste-file', handlePasteFile);
			window.removeEventListener('app:select-all-files', handleSelectAllFiles);
			window.removeEventListener('app:delete-file', handleDeleteFile);
			window.removeEventListener('app:rename-file', handleRenameFile);
			window.removeEventListener('app:refresh-file-list', handleRefreshFileList);
		};
	});

	// ============== Paste Implementation ==============

	async function handlePaste() {
		const clipboard = $state.snapshot($fileClipboardStore);

		if (!clipboard.files || clipboard.files.length === 0) {
			return;
		}

		const isCut = clipboard.operation === 'cut';
		const sourceIsLocal = clipboard.sourceType === 'local';
		const destIsLocal = type === 'local';
		const sourceSessionId = clipboard.sourceSessionId;
		const destSessionId = sessionId;

		const successfulFiles = [];
		let successCount = 0;

		try {
			for (const clipboardFile of clipboard.files) {
				try {
					const opType = determineOperationType(sourceIsLocal, destIsLocal, isCut);

					const destPath = await generateUniqueDestPath(
						clipboardFile.name,
						currentPath,
						destIsLocal,
						destSessionId
					);

					await executePasteOperation(
						opType,
						clipboardFile,
						destPath,
						sourceSessionId,
						destSessionId
					);
					successfulFiles.push(clipboardFile);
					successCount++;
				} catch (e) {
					console.error(`[PASTE] ❌ Failed to paste ${clipboardFile.name}:`, e);
				}
			}

			if (isCut && successfulFiles.length > 0) {
				await deleteSourceFiles(successfulFiles, sourceIsLocal, sourceSessionId);
				fileClipboardStore.clear();
			}

			await loadFiles(currentPath);
		} catch (e) {
			console.error('[PASTE] ❌ Paste operation failed:', e);
			error = `Paste failed: ${e.message || e}`;
		}
	}

	function determineOperationType(sourceIsLocal, destIsLocal, isCut) {
		if (sourceIsLocal && destIsLocal) return isCut ? 'move-local' : 'copy-local';
		if (!sourceIsLocal && !destIsLocal) return isCut ? 'move-remote' : 'copy-remote';
		if (sourceIsLocal && !destIsLocal) return 'upload';
		return 'download';
	}

	async function generateUniqueDestPath(fileName, targetDir, isLocal, sessionIdForRemote) {
		const basePath =
			targetDir.endsWith('/') || targetDir.endsWith('\\')
				? `${targetDir}${fileName}`
				: `${targetDir}/${fileName}`;
		let destPath = basePath;
		let counter = 1;

		while (true) {
			try {
				if (isLocal) {
					await getLocalFileStat(destPath);
				} else {
					await getRemoteFileStat(sessionIdForRemote, destPath);
				}
				const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
				const nameWithoutExt = ext ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
				destPath = `${targetDir.endsWith('/') || targetDir.endsWith('\\') ? targetDir : targetDir + '/'}${nameWithoutExt} (${counter})${ext}`;
				counter++;
			} catch {
				break;
			}
		}
		return destPath;
	}

	async function executePasteOperation(opType, file, destPath, sourceSessionId, destSessionId) {
		const transferId = crypto.randomUUID();

		try {
			switch (opType) {
				case 'copy-local':
					await copyLocalPath(file.path, destPath);
					break;
				case 'move-local':
					await moveLocalPath(file.path, destPath);
					break;
				case 'copy-remote':
					await copyRemotePath(sourceSessionId, file.path, destPath);
					break;
				case 'move-remote':
					await moveRemotePath(sourceSessionId, file.path, destPath);
					break;
				case 'upload':
					await uploadFile(destSessionId, file.path, destPath, transferId);
					break;
				case 'download':
					await downloadFile(sourceSessionId, file.path, destPath, transferId);
					break;
			}
		} catch (error) {
			console.error(`[PASTE] ❌ ${opType} failed:`, error);
			throw error;
		}
	}

	async function deleteSourceFiles(files, isLocal, sessionIdForRemote) {
		for (const file of files) {
			try {
				if (isLocal) {
					const { remove, removeDir } = await import('@tauri-apps/plugin-fs');
					if (file.isDirectory) {
						await removeDir(file.path, { recursive: true });
					} else {
						await remove(file.path);
					}
				} else {
					const { deleteRemotePath } = await import('$lib/services');
					await deleteRemotePath(sessionIdForRemote, file.path, file.isDirectory);
				}
			} catch (e) {
				console.error(`Failed to delete source file ${file.path}:`, e);
			}
		}
	}
</script>

<div class="file-panel flex flex-col h-full border-r border-border">
	<FilePanelHeader {title} {type} />

	<AddressBar
		path={currentPath}
		bind:pathTemp
		{pathHistory}
		{showHidden}
		{keyword}
		{loading}
		{inputFocus}
		{type}
		onPathChange={handlePathGo}
		onGo={handlePathGo}
		onRefresh={handleRefresh}
		onToggleHidden={handleToggleHidden}
		onGoParent={handleGoParent}
		onGoHome={handleGoHome}
		onKeywordChange={handleKeywordChange}
		onHistorySelect={handleHistorySelect}
		onInputFocus={handleInputFocus}
		onInputBlur={handleInputBlur}
	/>

	<FileListHeader {sortBy} {sortOrder} onSort={handleSort} />

	{#if loading}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-text-tertiary text-sm">Loading...</div>
		</div>
	{:else if error}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-[var(--color-error)] text-sm">{error}</div>
		</div>
	{:else}
		<FileList
			{fileToRename}
			files={paginatedFiles()}
			{totalFiles}
			{currentPage}
			{totalPages}
			{startIndex}
			{endIndex}
			{pageSize}
			{type}
			{hasHost}
			{enableSsh}
			{currentPath}
			bind:selectedIds
			onNavigate={handleNavigate}
			onFileAction={handleFileAction}
			onPageChange={page => {
				currentPage = Math.max(1, Math.min(page, totalPages));
			}}
		/>
	{/if}
</div>

<FilePropertiesModal
	bind:open={showPropertiesModal}
	file={propertiesFile}
	data={propertiesData}
	{type}
	{sessionId}
/>

<FilePermissionsModal bind:open={showPermissionsModal} file={permissionsFile} {type} {sessionId} />

<InputNameModal
	bind:this={inputNameModalRef}
	bind:open={showInputNameModal}
	type={inputNameModalType}
	onConfirm={inputNameModalCallback}
/>

<DeleteConfirmModal
	bind:open={showDeleteConfirmModal}
	files={filesToDelete}
	{deleting}
	onConfirm={async () => {
		if (deleting) return; // Prevent multiple delete operations

		deleting = true;
		try {
			const deletedPaths = await handleDeleteFiles(filesToDelete, type, fileService);
			// Reload directory from server to ensure UI is in sync
			// This ensures files that failed to delete (or were already deleted) are handled correctly
			await loadFiles(currentPath);
			selectedIds = [];
			showDeleteConfirmModal = false;
		} catch (e) {
			const errorMsg = e?.message || e?.toString() || String(e) || 'Unknown error';
			error = `Failed to delete: ${errorMsg}`;
			// Reload directory even on error to sync with server state
			loadFiles(currentPath).catch(err => {
				console.error('[FilePanel] Failed to reload after delete error:', err);
			});
		} finally {
			deleting = false;
		}
	}}
	onCancel={() => {
		if (!deleting) {
			showDeleteConfirmModal = false;
		}
	}}
/>
