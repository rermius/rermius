<script>
	import FileRow from './FileRow.svelte';
	import ContextMenu from './ContextMenu.svelte';
	import { fileClipboardStore } from '$lib/stores/file-clipboard.store';
	import {
		getFileMenuItems,
		getEmptyAreaMenuItems
	} from '$lib/utils/file-browser/context-menu-items';
	import { handleFileSelection } from '$lib/utils/file-browser/file-selection';
	import { Button, ScrollArea } from '$lib/components/ui';
	import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-svelte';

	let {
		files = [],
		selectedIds = $bindable([]),
		type = 'local',
		hasHost = false,
		enableSsh = true,
		currentPath = '',
		fileToRename = null,
		onNavigate,
		onFileAction,
		onDrop,
		onDragOver,
		// Pagination props
		totalFiles = 0,
		currentPage = 1,
		totalPages = 1,
		startIndex = 0,
		endIndex = 0,
		pageSize = 50,
		onPageChange
	} = $props();

	// Display files without ".." parent navigation
	const displayFiles = $derived(files);

	function handleSelect(file, event) {
		if (file.name === '..') {
			selectedIds = [];
			return;
		}
		selectedIds = handleFileSelection(file, event, selectedIds, displayFiles);
	}

	function handleDoubleClick(file) {
		const fileSnapshot = $state.snapshot(file);

		// Symlink to directory: navigate to target path
		if (file.isSymlink && file.symlinkTarget && file.isDirectory) {
			onNavigate?.({
				...file,
				path: file.symlinkTarget,
				name: file.symlinkTarget.split('/').pop() || file.name
			});
			return;
		}

		if (file.name === '..' || file.isDirectory) {
			onNavigate?.(file);
		} else {
			onFileAction?.(file, 'open');
		}
	}

	function handleKeyDown(event) {
		const currentIndex = displayFiles.findIndex(f => selectedIds.includes(f.path));

		switch (event.key) {
			case 'ArrowUp':
				event.preventDefault();
				if (currentIndex > 0) {
					const prevFile = displayFiles[currentIndex - 1];
					selectedIds = prevFile.name === '..' ? [] : [prevFile.path];
				}
				break;
			case 'ArrowDown':
				event.preventDefault();
				if (currentIndex < displayFiles.length - 1) {
					const nextFile = displayFiles[currentIndex + 1];
					selectedIds = nextFile.name === '..' ? [] : [nextFile.path];
				}
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedIds.length === 1) {
					const file = displayFiles.find(f => f.path === selectedIds[0]);
					if (file) handleDoubleClick(file);
				}
				break;
			case 'Backspace':
				event.preventDefault();
				onNavigate?.({ name: '..', isDirectory: true });
				break;
		}
	}

	function handleDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		onDragOver?.(e);
	}

	function handleDrop(e) {
		e.preventDefault();
		onDrop?.(e, currentPath);
	}

	function handleEmptyAreaClick(e) {
		// Deselect all files when clicking on empty area
		if (e.target === e.currentTarget || e.target.classList.contains('file-list')) {
			selectedIds = [];
		}
	}

	function handleEmptyAreaAction(actionId) {
		// Handle actions from empty area context menu
		onFileAction?.(actionId, null);
	}

	// Context menu state (Electerm-style: single handler with flag)
	let showContextMenu = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });
	let isEmptyContextMenu = $state(false);
	let contextMenuFile = $state(null);

	function handleFileListContextMenu(e) {
		// Prevent default browser context menu
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		const target = e.target;
		const fileRow = target.closest('.file-row');

		// Check if clicking on a file row
		if (fileRow) {
			// Find which file was clicked
			const filePath = fileRow.getAttribute('data-file-path');

			// Try to find file by path, handle both string and undefined cases
			const clickedFile = displayFiles.find(f => {
				return f.path === filePath || (f.path && filePath && String(f.path) === String(filePath));
			});

			if (clickedFile && clickedFile.name !== '..') {
				// File context menu
				isEmptyContextMenu = false;
				// Use snapshot to avoid proxy issues
				contextMenuFile = $state.snapshot(clickedFile);
			} else {
				// Clicked on ".." or invalid, treat as empty area
				isEmptyContextMenu = true;
				contextMenuFile = null;
			}
		} else {
			// Empty area context menu
			isEmptyContextMenu = true;
			contextMenuFile = null;
		}

		contextMenuPosition = { x: e.clientX, y: e.clientY };
		showContextMenu = true;
	}

	function handleContextMenuClose() {
		showContextMenu = false;
		isEmptyContextMenu = false;
		contextMenuFile = null;
	}

	function handleContextMenuItemClick(item) {
		if (item.disabled) return;

		// Save state before clearing
		const wasEmptyContextMenu = isEmptyContextMenu;
		const fileSnapshot = contextMenuFile ? $state.snapshot(contextMenuFile) : null;

		// Close menu FIRST before any action (prevents re-render issues)
		showContextMenu = false;
		isEmptyContextMenu = false;
		contextMenuFile = null;

		// Then process action (which might trigger re-render)
		if (wasEmptyContextMenu) {
			// Empty area actions (refresh, selectAll, newFile, newFolder, etc.)
			handleEmptyAreaAction(item.id);
		} else if (fileSnapshot) {
			// File-specific actions
			handleFileAction(item.id, fileSnapshot);
		}
	}

	function getContextMenuItems() {
		if (isEmptyContextMenu) {
			return getEmptyAreaMenuItems({ canPaste });
		} else if (contextMenuFile) {
			return getFileMenuItems(contextMenuFile, {
				selectedFiles,
				type,
				hasHost,
				enableSsh,
				canPaste
			});
		}
		return [];
	}

	const contextMenuItems = $derived(getContextMenuItems());

	const selectedFiles = $derived(files.filter(f => selectedIds.includes(f.path)));

	// Clipboard state for paste and cut visual feedback
	const clipboard = $derived($fileClipboardStore);
	const canPaste = $derived(clipboard.files.length > 0);
	const cutFilePaths = $derived(
		clipboard.operation === 'cut' ? new Set(clipboard.files.map(f => f.path)) : new Set()
	);

	function handleFileAction(actionId, file) {
		onFileAction?.(actionId, file);
	}

	function handleDragStart(file, e) {
		// Drag started
	}

	function handleDragEnd(file, e) {
		// Drag ended
	}

	// Pagination handlers
	let pageInput = $state('');
	const showPagination = $derived(totalFiles > pageSize && files.length > 0);

	// Sync pageInput when currentPage changes
	$effect(() => {
		pageInput = String(currentPage);
	});

	function handlePageInput() {
		const page = parseInt(pageInput, 10);
		if (!isNaN(page) && page >= 1 && page <= totalPages) {
			onPageChange?.(page);
		} else {
			// Reset to current page if invalid
			pageInput = String(currentPage);
		}
	}

	function handlePageInputKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handlePageInput();
		}
	}
</script>

<div class="flex flex-col flex-1 overflow-hidden">
	<!-- Scrollable file list -->
	<ScrollArea class="flex-1">
		<div
			class="file-list bg-dark min-h-full pb-20"
			onkeydown={handleKeyDown}
			ondragover={handleDragOver}
			ondrop={handleDrop}
			onclick={handleEmptyAreaClick}
			oncontextmenu={handleFileListContextMenu}
			role="grid"
			tabindex="0"
		>
			{#each displayFiles as file, index ((file.path || file.name) + '-' + index)}
				<FileRow
					{file}
					isSelected={selectedIds.includes(file.path)}
					{selectedFiles}
					{type}
					{hasHost}
					{enableSsh}
					{canPaste}
					isCut={cutFilePaths.has(file.path)}
					shouldStartEdit={fileToRename === file.path}
					onSelect={handleSelect}
					onDoubleClick={handleDoubleClick}
					onAction={handleFileAction}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					data-file-path={file.path}
				/>
			{/each}

			{#if files.length === 0}
				<div class="flex items-center justify-center h-32 text-white/40 text-sm">
					Empty directory
				</div>
			{/if}
		</div>
	</ScrollArea>

	<!-- Sticky pagination controls at bottom -->
	{#if showPagination}
		<div
			class="sticky bottom-0 px-4 py-3 border-t border-border bg-bg-secondary flex items-center justify-between gap-4 flex-wrap z-10"
		>
			<!-- Left: Navigation buttons -->
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => onPageChange?.(1)}
					disabled={currentPage === 1}
					title="First page"
				>
					<ChevronsLeft size={16} />
					<span class="hidden sm:inline">First</span>
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onclick={() => onPageChange?.(currentPage - 1)}
					disabled={currentPage === 1}
					title="Previous page"
				>
					<ChevronLeft size={16} />
					<span class="hidden sm:inline">Prev</span>
				</Button>
			</div>

			<!-- Center: Page input -->
			<div class="flex items-center gap-2">
				<span class="text-sm text-text-tertiary">Page</span>
				<input
					type="number"
					min="1"
					max={totalPages}
					bind:value={pageInput}
					class="w-16 px-2 py-1 text-center text-sm bg-bg-surface border border-border rounded focus:ring-1 focus:ring-active focus:border-active outline-none"
					onkeydown={handlePageInputKeydown}
					onblur={handlePageInput}
					title="Enter page number"
				/>
				<span class="text-sm text-text-tertiary">of {totalPages}</span>
			</div>

			<!-- Right: Next/Last + Info -->
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => onPageChange?.(currentPage + 1)}
						disabled={currentPage >= totalPages}
						title="Next page"
					>
						<span class="hidden sm:inline">Next</span>
						<ChevronRight size={16} />
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onclick={() => onPageChange?.(totalPages)}
						disabled={currentPage >= totalPages}
						title="Last page"
					>
						<span class="hidden sm:inline">Last</span>
						<ChevronsRight size={16} />
					</Button>
				</div>

				<span class="text-sm text-text-tertiary">
					Showing {startIndex + 1}-{endIndex} of {totalFiles}
					{totalFiles === 1 ? 'file' : 'files'}
				</span>
			</div>
		</div>
	{/if}
</div>

<ContextMenu
	bind:open={showContextMenu}
	bind:position={contextMenuPosition}
	items={contextMenuItems}
	onItemClick={handleContextMenuItemClick}
	onClose={handleContextMenuClose}
/>

<style>
	.file-list:focus {
		outline: none;
	}
</style>
