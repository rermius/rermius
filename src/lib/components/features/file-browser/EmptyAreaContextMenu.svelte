<script>
	import * as LucideIcons from 'lucide-svelte';
	import { adjustDropdownPosition } from '$lib/utils';
	import { keyboardShortcutManager } from '$lib/services/keyboard-shortcuts';
	import { onMount } from 'svelte';

	const { type = 'local', canPaste = false, onAction, children } = $props();

	// Helper to get shortcut with fallback to defaults
	function getShortcutDisplay(actionName, defaultValue) {
		return keyboardShortcutManager.getShortcut(actionName) || defaultValue;
	}

	function getMenuItems() {
		const items = [];

		// New File
		items.push({
			id: 'newFile',
			icon: LucideIcons.FilePlus,
			label: 'New File'
		});

		// New Folder
		items.push({
			id: 'newFolder',
			icon: LucideIcons.FolderPlus,
			label: 'New Folder'
		});

		// Separator
		items.push({ id: 'separator' });

		// Paste (if available)
		if (canPaste) {
			items.push({
				id: 'paste',
				icon: LucideIcons.Clipboard,
				label: 'Paste',
				disabled: !canPaste
			});
		}

		// Separator before selection/refresh
		items.push({ id: 'separator' });

		// Select All
		items.push({
			id: 'selectAll',
			icon: LucideIcons.CheckSquare,
			label: 'Select All',
			shortcut: getShortcutDisplay('selectAllFiles', 'Ctrl+Shift+A')
		});

		// Refresh
		items.push({
			id: 'refresh',
			icon: LucideIcons.RefreshCw,
			label: 'Refresh',
			shortcut: getShortcutDisplay('refreshFileList', 'F5')
		});

		return items;
	}

	// Generate menu items fresh when menu opens (not $derived) to get latest shortcuts
	let menuItems = $state([]);
	let showMenu = $state(false);
	let menuPosition = $state({ x: 0, y: 0 });
	let menuRef = $state(null);
	let portalContainer = $state(null);

	function handleContextMenu(e) {
		// Don't show empty area menu if clicking on a file row
		// File rows have their own context menu
		const target = e.target;
		const isFileRow = target.closest('.file-row') || target.closest('.file-context-menu-wrapper');

		if (isFileRow) {
			// Let the file row's context menu handle it - don't prevent default
			// The event will bubble up to FileContextMenu
			return;
		}

		// Only show empty area menu if clicking on empty space
		e.preventDefault();
		e.stopPropagation();
		const x = e.clientX;
		const y = e.clientY;
		menuPosition = { x, y };

		// Generate menu items NOW to get current shortcuts
		menuItems = getMenuItems();
		showMenu = true;

		// Adjust position after menu is rendered
		requestAnimationFrame(() => {
			if (menuRef) {
				menuPosition = adjustDropdownPosition(menuRef, x, y);
			}
		});
	}

	// Portal pattern - mount menu to document.body to escape all stacking contexts
	onMount(() => {
		portalContainer = document.createElement('div');
		portalContainer.className = 'empty-area-context-menu-portal';
		document.body.appendChild(portalContainer);

		return () => {
			if (portalContainer && document.body.contains(portalContainer)) {
				document.body.removeChild(portalContainer);
			}
		};
	});

	// Mount/unmount menu in portal
	$effect(() => {
		if (!portalContainer || !showMenu || !menuRef) return;

		// Find the context-menu-container and move it to portal
		const container = menuRef.closest('.context-menu-container');
		if (container && container.parentElement !== portalContainer) {
			const originalParent = container.parentElement;
			portalContainer.appendChild(container);

			// Cleanup: move back when menu closes
			return () => {
				if (container && portalContainer.contains(container) && originalParent) {
					originalParent.appendChild(container);
				}
			};
		}
	});

	function handleItemClick(item) {
		if (item.disabled) {
			return;
		}
		showMenu = false;
		onAction?.(item.id);
	}

	function handleClose() {
		showMenu = false;
	}
</script>

<div
	class="empty-area-context-menu-wrapper"
	oncontextmenu={handleContextMenu}
	role="group"
	style="width: 100%; height: 100%;"
>
	{@render children()}
</div>

<!-- Portal container - will be moved to document.body -->
{#if showMenu}
	<div class="context-menu-container">
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 bg-transparent border-none p-0 cursor-default"
			style="z-index: var(--z-modal-backdrop);"
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
			class="fixed bg-(--color-bg-tertiary) border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
			style="left: {menuPosition.x}px; top: {menuPosition.y}px; z-index: var(--z-popover);"
			oncontextmenu={e => e.preventDefault()}
			role="menu"
			tabindex="-1"
		>
			{#each menuItems as item (item.id)}
				{#if item.id === 'separator'}
					<div class="h-px bg-border my-1"></div>
				{:else}
					{@const Icon = item.icon}
					<button
						type="button"
						class="w-full px-3 py-2 flex items-center gap-2 text-sm text-white/80 hover:bg-border hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={item.disabled}
						onclick={() => handleItemClick(item)}
					>
						<Icon size={16} />
						<span>{item.label}</span>
						{#if item.shortcut}
							<span class="ml-auto text-xs text-white/40">{item.shortcut}</span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>
	</div>
{/if}
