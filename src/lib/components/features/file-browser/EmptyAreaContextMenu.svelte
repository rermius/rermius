<script>
	import * as LucideIcons from 'lucide-svelte';
	import { adjustDropdownPosition } from '$lib/utils/dropdown-position';

	let { type = 'local', canPaste = false, onAction, children } = $props();

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
			shortcut: 'Ctrl+A'
		});

		// Refresh
		items.push({
			id: 'refresh',
			icon: LucideIcons.RefreshCw,
			label: 'Refresh',
			shortcut: 'F5'
		});

		return items;
	}

	const menuItems = $derived(getMenuItems());

	let showMenu = $state(false);
	let menuPosition = $state({ x: 0, y: 0 });
	let menuRef = $state(null);

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
		showMenu = true;

		// Adjust position after menu is rendered
		requestAnimationFrame(() => {
			if (menuRef) {
				menuPosition = adjustDropdownPosition(menuRef, x, y);
			}
		});
	}

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
			class="fixed z-50 bg-(--color-bg-tertiary) border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
			style="left: {menuPosition.x}px; top: {menuPosition.y}px;"
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
	{/if}
</div>
