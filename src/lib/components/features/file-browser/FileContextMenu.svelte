<script>
	import * as LucideIcons from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';
	import { adjustDropdownPosition } from '$lib/utils/dropdown-position';

	const {
		file = null,
		selectedFiles = [],
		type = 'local', // 'local' | 'sftp' | 'ftp'
		hasHost = false, // Has remote connection (for dual-pane mode)
		enableSsh = true, // SSH enabled (for terminal access)
		canPaste = false,
		onAction,
		children
	} = $props();

	const maxEditFileSize = 1024 * 3000; // 3MB

	// Derived flags (like Electerm)
	const isFtp = $derived(type === 'ftp');
	const isLocal = $derived(type === 'local');
	const isRemote = $derived(type === 'sftp' || type === 'ftp');
	const isWin = $derived(typeof window !== 'undefined' && navigator.platform.includes('Win'));

	function getMenuItems() {
		if (!file) return [];

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

		if (!multiSelect && hasHost && isRealFile) {
			items.push({
				id: 'transfer',
				icon: isLocal ? LucideIcons.Upload : LucideIcons.Download,
				label: isLocal ? 'Upload' : 'Download'
			});

			if (isDirectory && !isFtp) {
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
		// Open and Open With for local and remote files (not directories)
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

		// Show in Explorer only for local files
		if (isRealFile && isLocal) {
			items.push({
				id: 'showInExplorer',
				icon: LucideIcons.FolderOpen,
				label: 'Show in Explorer'
			});
		}

		// Edit only for small files when Open is NOT available
		// Hide Edit if Open/Open With are available (because Open = Edit)
		if (isSmallFile && isRealFile && !hasOpenOptions) {
			items.push({
				id: 'edit',
				icon: LucideIcons.Edit,
				label: 'Edit'
			});
		}

		// Separator after open/edit group
		if ((isRealFile && isLocal) || (isSmallFile && isRealFile)) {
			items.push({ id: 'separator' });
		}

		// === CLIPBOARD GROUP ===
		if (isRealFile) {
			items.push({
				id: 'delete',
				icon: LucideIcons.Trash2,
				label: multiSelect ? `Delete All (${selectedFiles.length})` : 'Delete',
				danger: true
			});

			items.push({
				id: 'copy',
				icon: LucideIcons.Copy,
				label: 'Copy',
				shortcut: 'Ctrl+C'
			});

			items.push({
				id: 'cut',
				icon: LucideIcons.Scissors,
				label: 'Cut',
				shortcut: 'Ctrl+X'
			});
		}

		items.push({
			id: 'paste',
			icon: LucideIcons.Clipboard,
			label: 'Paste',
			shortcut: 'Ctrl+V',
			disabled: !canPaste
		});

		// Separator after clipboard group
		items.push({ id: 'separator' });

		// === FILE OPERATIONS GROUP ===
		if (isRealFile) {
			items.push({
				id: 'rename',
				icon: LucideIcons.Edit3,
				label: 'Rename',
				shortcut: 'F2'
			});

			items.push({
				id: 'copyPath',
				icon: LucideIcons.Link,
				label: 'Copy Path'
			});
		}

		// New file/folder (not available for FTP)
		if (enableSsh || isLocal) {
			if (isFtp) {
				// FTP doesn't support new file/folder
			} else {
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
			}
		}

		// Separator after file operations
		items.push({ id: 'separator' });

		// === SELECTION GROUP ===
		items.push({
			id: 'selectAll',
			icon: LucideIcons.CheckSquare,
			label: 'Select All',
			shortcut: 'Ctrl+A'
		});

		items.push({
			id: 'refresh',
			icon: LucideIcons.RefreshCw,
			label: 'Refresh',
			shortcut: 'F5'
		});

		// Separator before permissions/info
		items.push({ id: 'separator' });

		// === PERMISSIONS/INFO GROUP ===
		// Edit permissions (SFTP) or View permissions (FTP - read-only)
		// Show for remote files (SFTP can edit, FTP can only view)
		// Note: isWin check is for local files, not remote files
		if (isRealFile && isRemote) {
			if (isFtp) {
				// FTP: View permissions only (read-only)
				items.push({
					id: 'permissions',
					icon: LucideIcons.Lock,
					label: 'View Permissions'
				});
			} else {
				// SFTP: Edit permissions
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

	const menuItems = $derived(getMenuItems());

	let showMenu = $state(false);
	let menuPosition = $state({ x: 0, y: 0 });
	let menuRef = $state(null);

	function handleContextMenu(e) {
		e.preventDefault();
		const x = e.clientX;
		const y = e.clientY;
		menuPosition = { x, y };
		showMenu = true;

		// Adjust position after menu is rendered
		requestAnimationFrame(() => {
			if (menuRef) {
				menuPosition = adjustDropdownPosition(menuRef, x, y);
			}
		});
	}

	function handleItemClick(item) {
		console.log('[ContextMenu] Item clicked:', item.id, 'for file:', file?.name);
		if (item.disabled) {
			console.log('[ContextMenu] Item disabled, skipping');
			return;
		}
		showMenu = false;
		// Notify parent via onAction prop
		if (onAction) {
			console.log('[ContextMenu] Calling onAction with id:', item.id);
			onAction(item.id);
		}
	}

	function handleClose() {
		showMenu = false;
	}
</script>

<div class="file-context-menu-wrapper" oncontextmenu={handleContextMenu} role="group">
	{@render children()}

	{#if showMenu}
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 z-40 bg-transparent border-none p-0 cursor-default"
			onclick={handleClose}
			oncontextmenu={e => {
				e.preventDefault();
				handleClose();
			}}
			aria-label="Close context menu"
		></button>

		<!-- Menu -->
		<div
			bind:this={menuRef}
			class="fixed bg-dark-50 border bg-bg-secondary rounded-lg shadow-lg z-50 min-w-[200px] max-w-[calc(100vw-20px)] max-h-[calc(100vh-20px)]"
			style="left: {menuPosition.x}px; top: {menuPosition.y}px;"
			oncontextmenu={e => e.preventDefault()}
			role="menu"
			tabindex="-1"
		>
		<ScrollArea class="h-full">
			<div class="py-1">
				{#each menuItems as item (item.id)}
					{#if item.id === 'separator'}
						<div class="h-px bg-border my-1"></div>
					{:else}
						<button
							class="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/80 hover:bg-dark-100 transition-colors
							{item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
							{item.danger ? 'text-red-400 hover:text-red-300' : ''}"
								onclick={() => handleItemClick(item)}
								disabled={item.disabled}
								role="menuitem"
							>
								{#if item.icon}
									{@const Icon = item.icon}
									<Icon size={14} />
								{/if}
								<span class="flex-1 text-left">{item.label}</span>
								{#if item.shortcut}
									<span class="text-white/40 text-[10px]">{item.shortcut}</span>
								{/if}
							</button>
						{/if}
					{/each}
				</div>
			</ScrollArea>
		</div>
	{/if}
</div>

<style>
	.file-context-menu-wrapper {
		position: relative;
	}
</style>
