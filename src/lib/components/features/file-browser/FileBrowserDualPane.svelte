<script>
	import { onMount } from 'svelte';
	import { initFileTransferProgressListener } from '$lib/services/file-transfer-events';

	// Initialize file transfer progress listener when component mounts
	onMount(async () => {
		try {
			await initFileTransferProgressListener();
		} catch (e) {
			console.error('[FileBrowserDualPane] Failed to init listener:', e);
		}
	});
	import FilePanel from './FilePanel.svelte';
	import { createFileService, getHomeDirectory, joinPath } from '$lib/services/file-browser';
	import { hostsStore } from '$lib/services/hosts';
	import { getDropFileList } from '$lib/utils/file-drop';
	import { statusBarStore } from '$lib/stores/status-bar';
	import { generateUniqueFileName } from '$lib/utils/filename-utils';

	let {
		// Left panel (Local)
		localInitialPath: _localInitialPath = '',

		// Right panel (Remote)
		sessionId = null,
		remoteType = 'sftp', // sftp | ftp | ftps
		remoteInitialPath = '/',
		hostId = null
	} = $props();

	// Initialize local path to home directory
	let localInitialPath = $state('');

	$effect(async () => {
		if (!localInitialPath) {
			if (_localInitialPath) {
				localInitialPath = _localInitialPath;
			} else {
				try {
					const homeDir = await getHomeDirectory();
					const normalizedPath = homeDir.replace(/\\/g, '/');
					if (normalizedPath) {
						localInitialPath = normalizedPath;
						console.log('[FileBrowserDualPane] Set local path to home:', localInitialPath);
					}
				} catch (e) {
					console.error('[FileBrowserDualPane] Failed to get home directory:', e);
					// Don't set empty path, let FilePanel handle it
				}
			}
		}
	});

	const hosts = $derived($hostsStore.hosts || []);
	const host = $derived(hostId ? hosts.find(h => h.id === hostId) : null);

	// Split pane state
	let leftWidth = $state(50); // Percentage
	let isDragging = $state(false);

	// Drag state
	let isDraggingOverPane = $state(null); // 'local' | 'remote' | null

	// Track current paths for both panels
	let localCurrentPath = $state('');
	let remoteCurrentPath = $state('/');

	// Create file services - use $effect to react to sessionId changes
	let localFileService = $state(null);
	let remoteFileService = $state(null);

	$effect(() => {
		localFileService = createFileService(null, true);
		remoteFileService = sessionId ? createFileService(sessionId, false) : null;
	});

	function handleMouseDown(e) {
		isDragging = true;
		e.preventDefault();
	}

	function handleMouseMove(e) {
		if (!isDragging) return;

		const container = e.currentTarget.closest('.dual-pane-container');
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const leftPercent = (x / rect.width) * 100;

		// Constrain between 20% and 80%
		leftWidth = Math.max(20, Math.min(80, leftPercent));
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleTransferRequest(side, action, files) {
		const shouldTransfer =
			(action === 'transfer' || action === 'download' || action === 'upload') && files.length > 0;

		if (shouldTransfer) {
			// Start all transfers in parallel (not sequential)
			const transferPromises = files.map(file => startTransfer(side, file, action));
			// Don't await - let them run in parallel
			Promise.allSettled(transferPromises).then(results => {
				const failed = results.filter(r => r.status === 'rejected');
				if (failed.length > 0) {
					console.error(`[Transfer] Failed: ${failed.length} out of ${files.length} transfers`);
					failed.forEach((result, index) => {
						const fileIndex = results.indexOf(result);
						const file = files[fileIndex];
						const error = result.reason;
						console.error(`[Transfer] Failed file ${fileIndex + 1}/${files.length}:`, {
							fileName: file?.name || 'unknown',
							filePath: file?.path || 'unknown',
							error: error?.message || String(error),
							stack: error?.stack
						});
					});
				}
			});
		}
	}

	// Track transfer controllers for cancellation (one per file)
	const transferControllers = new Map();

	// Helper: Cleanup transfer controller
	function cleanupTransfer(transferId) {
		transferControllers.delete(transferId);
	}

	// Helper: Handle transfer completion/error
	function handleTransferResult(
		transferId,
		abortController,
		isUpload,
		fileName,
		fromPath,
		toPath,
		error
	) {
		cleanupTransfer(transferId);

		if (error && error.message !== 'Transfer cancelled' && !abortController.signal.aborted) {
			const action = isUpload ? 'upload' : 'download';
			console.error(`[Transfer] ${action} failed:`, {
				fileName,
				fromPath,
				toPath,
				error: error.message || String(error),
				stack: error.stack
			});
			const updateFn = isUpload ? statusBarStore.showUpload : statusBarStore.showDownload;
			updateFn({
				fileName,
				progress: 0,
				status: 'error',
				error: error.message,
				fromPath,
				toPath: isUpload ? remoteCurrentPath || '/' : localCurrentPath || ''
			});
		}
	}

	async function startTransfer(side, file, action = 'transfer') {
		const isUpload = action === 'upload' || (action === 'transfer' && side === 'local');
		// Create unique transfer ID (long random string) to send to backend
		// Backend will echo this ID back in events for matching
		const transferId = crypto.randomUUID();
		const abortController = new AbortController();
		transferControllers.set(transferId, abortController);

		const onCancel = () => {
			abortController.abort();
			cleanupTransfer(transferId);
		};

		// Import modules first (before using joinPath)
		const [{ downloadFile, uploadFile, joinPath: joinPathFn }, { join, downloadDir }] =
			await Promise.all([import('$lib/services/file-browser'), import('@tauri-apps/api/path')]);

		// Show transfer immediately in status bar (after imports)
		const localPath = file.path;
		const remoteDir = remoteCurrentPath || '/';
		const localDir = localCurrentPath || '';

		if (isUpload) {
			// Show upload immediately with original filename (will update with unique name later)
			statusBarStore.showUpload({
				id: transferId,
				fileName: file.name,
				progress: 0,
				status: 'uploading',
				fromPath: localPath,
				toPath: joinPathFn(remoteDir, file.name),
				onCancel
			});
		} else {
			// Show download immediately with original filename
			statusBarStore.showDownload({
				id: transferId,
				fileName: file.name,
				progress: 0,
				status: 'downloading',
				fromPath: file.path,
				toPath: '',
				onCancel
			});
		}

		if (abortController.signal.aborted) {
			cleanupTransfer(transferId);
			return;
		}

		if (isUpload) {
			if (!sessionId || !remoteFileService) {
				cleanupTransfer(transferId);
				const errorMsg = !sessionId
					? 'No session ID available'
					: 'No remote file service available';
				console.error('[Transfer] Failed to start upload:', {
					fileName: file.name,
					filePath: file.path,
					reason: errorMsg,
					sessionId: sessionId || null,
					hasRemoteFileService: !!remoteFileService
				});
				return;
			}

			// Backend will handle duplicate check and rename automatically
			const remotePath = joinPathFn(remoteDir, file.name);

			console.log('[Transfer] Starting upload:', {
				fileName: file.name,
				fromPath: localPath,
				toPath: remotePath
			});

			// Start upload immediately - backend will check for duplicates and rename if needed
			uploadFile(sessionId, localPath, remotePath, transferId)
				.then(() => {
					console.log('[Transfer] Upload completed:', file.name);
					cleanupTransfer(transferId);
				})
				.catch(error => {
					console.error('[Transfer] Upload error caught:', {
						fileName: file.name,
						fromPath: localPath,
						toPath: remotePath,
						error: error?.message || String(error),
						stack: error?.stack
					});
					handleTransferResult(
						transferId,
						abortController,
						true,
						file.name,
						file.path,
						remotePath,
						error
					);
				});
		} else {
			if (!localFileService) {
				cleanupTransfer(transferId);
				console.error('[Transfer] Failed to start download:', {
					fileName: file.name,
					filePath: file.path,
					reason: 'Local file service not available',
					hasLocalFileService: !!localFileService
				});
				return;
			}

			let uniqueFileName = file.name; // Track uniqueFileName for error handling

			downloadDir()
				.then(async downloadsFolder => {
					// Check for duplicate and get unique filename
					let localFiles = [];
					try {
						localFiles = await localFileService.listLocalDirectory(downloadsFolder);
					} catch (listError) {
						console.warn('[Transfer] Failed to list local directory for duplicate check:', {
							downloadsFolder,
							error: listError?.message || String(listError)
						});
						// Continue anyway - duplicate check will just use empty list
					}

					uniqueFileName = generateUniqueFileName(file.name, localFiles);
					const localPath = await join(downloadsFolder, uniqueFileName);
					const remotePath = file.path;

					if (abortController.signal.aborted) {
						cleanupTransfer(transferId);
						return;
					}

					// Use transferId as unique ID (generated by frontend, echoed by backend)
					statusBarStore.showDownload({
						id: transferId,
						fileName: uniqueFileName,
						progress: 0,
						status: 'downloading',
						fromPath: remotePath,
						toPath: localPath,
						onCancel
					});

					console.log('[Transfer] Starting download:', {
						fileName: uniqueFileName,
						originalName: file.name,
						fromPath: remotePath,
						toPath: localPath
					});
					return downloadFile(sessionId, remotePath, localPath, transferId);
				})
				.then(() => {
					console.log('[Transfer] Download completed:', uniqueFileName);
					cleanupTransfer(transferId);
				})
				.catch(error => {
					console.error('[Transfer] Download error caught:', {
						fileName: uniqueFileName,
						fromPath: file.path,
						toPath: 'downloads folder',
						error: error?.message || String(error),
						stack: error?.stack
					});
					handleTransferResult(
						transferId,
						abortController,
						false,
						uniqueFileName,
						file.path,
						'',
						error
					);
				});
		}
	}

	function handlePaneDragOver(pane, e) {
		e.preventDefault();
		e.stopPropagation();
		isDraggingOverPane = pane;
		e.dataTransfer.dropEffect = 'move';
	}

	function handlePaneDragLeave(pane, e) {
		e.preventDefault();
		e.stopPropagation();
		// Only clear if not dragging over another pane
		setTimeout(() => {
			if (isDraggingOverPane === pane) {
				isDraggingOverPane = null;
			}
		}, 100);
	}

	async function handlePaneDrop(pane, e) {
		e.preventDefault();
		e.stopPropagation();
		isDraggingOverPane = null;

		const droppedFiles = getDropFileList(e.dataTransfer);
		if (!droppedFiles || droppedFiles.length === 0) return;

		const targetSide = pane;
		const sourceSide = targetSide === 'local' ? 'remote' : 'local';

		// Create transfer tasks
		handleTransferRequest(sourceSide, 'transfer', droppedFiles);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="dual-pane-container flex h-full bg-dark"
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
	onmouseleave={handleMouseUp}
	role="application"
	aria-label="File browser dual pane"
>
	<!-- Left Panel (Local) -->
	<div
		class="shrink-0 border-r border-[#3E4257] {isDraggingOverPane === 'local'
			? 'bg-primary/10 border-primary border-2 border-dashed'
			: ''}"
		style="width: {leftWidth}%"
		ondragover={e => handlePaneDragOver('local', e)}
		ondragleave={e => handlePaneDragLeave('local', e)}
		ondrop={e => handlePaneDrop('local', e)}
		role="region"
		aria-label="Local files panel"
	>
		<FilePanel
			type="local"
			title="Local"
			initialPath={localInitialPath}
			fileService={localFileService}
			onTransferRequest={(action, files) => handleTransferRequest('local', action, files)}
			onPathChange={path => {
				localCurrentPath = path;
			}}
		/>
	</div>

	<!-- Resizer -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
	<div
		class="resizer w-1 bg-border cursor-col-resize hover:bg-active transition-colors shrink-0"
		onmousedown={handleMouseDown}
		role="separator"
		aria-orientation="vertical"
		aria-label="Resize panels"
	></div>

	<!-- Right Panel (Remote) -->
	<div
		class="flex-1 {isDraggingOverPane === 'remote'
			? 'bg-primary/10 border-primary border-2 border-dashed'
			: ''}"
		style="width: {100 - leftWidth}%"
		ondragover={e => handlePaneDragOver('remote', e)}
		ondragleave={e => handlePaneDragLeave('remote', e)}
		ondrop={e => handlePaneDrop('remote', e)}
		role="region"
		aria-label="Remote files panel"
	>
		{#if sessionId && remoteFileService}
			<FilePanel
				{sessionId}
				type={remoteType}
				title={host?.label || 'Remote'}
				initialPath={remoteInitialPath}
				fileService={remoteFileService}
				onTransferRequest={(action, files) => handleTransferRequest('remote', action, files)}
				onPathChange={path => {
					remoteCurrentPath = path;
				}}
			/>
		{:else}
			<div
				class="flex items-center justify-center h-full text-white/40"
				role="status"
				aria-label="No remote connection"
			>
				No remote connection
			</div>
		{/if}
	</div>
</div>

<style>
	.resizer:active {
		background-color: var(--color-active);
	}
</style>
