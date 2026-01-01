<script>
	import ContextMenuItem from './ContextMenuItem.svelte';
	import ContextMenuDivider from './ContextMenuDivider.svelte';

	const {
		open = false,
		position = { x: 0, y: 0 },
		items = [],
		onClose,
		onSelect,
		minWidth = '180px',
		maxWidth = '240px',
		zIndex = 1060
	} = $props();

	let menuElement = $state(null);
	let adjustedPosition = $state({ x: 0, y: 0 });
	let isPositioned = $state(false);

	// Calculate position with viewport overflow detection
	$effect(() => {
		if (open && menuElement) {
			const rect = menuElement.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			let finalX = position.x;
			let finalY = position.y;

			// Horizontal overflow check
			if (position.x + rect.width > viewportWidth) {
				finalX = Math.max(8, position.x - rect.width);
			}

			// Vertical overflow check
			if (position.y + rect.height > viewportHeight) {
				finalY = Math.max(8, position.y - rect.height);
			}

			// Edge case: Menu too large for viewport
			if (rect.width > viewportWidth - 16) {
				finalX = 8;
			}
			if (rect.height > viewportHeight - 16) {
				finalY = 8;
			}

			adjustedPosition = { x: finalX, y: finalY };
			isPositioned = true;
		} else {
			isPositioned = false;
		}
	});

	// Click outside detection
	$effect(() => {
		if (open) {
			const handleClickOutside = (event) => {
				if (menuElement && !menuElement.contains(event.target)) {
					onClose?.();
				}
			};

			// Use capture phase to handle before other handlers
			window.addEventListener('click', handleClickOutside, true);

			return () => {
				window.removeEventListener('click', handleClickOutside, true);
			};
		}
	});

	// Keyboard navigation
	function handleKeydown(event) {
		if (!open) return;

		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				onClose?.();
				break;
			case 'ArrowDown':
				event.preventDefault();
				focusNextItem();
				break;
			case 'ArrowUp':
				event.preventDefault();
				focusPreviousItem();
				break;
		}
	}

	function focusNextItem() {
		if (!menuElement) return;
		const items = menuElement.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])');
		const currentIndex = Array.from(items).indexOf(document.activeElement);
		const nextIndex = currentIndex + 1 < items.length ? currentIndex + 1 : 0;
		items[nextIndex]?.focus();
	}

	function focusPreviousItem() {
		if (!menuElement) return;
		const items = menuElement.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])');
		const currentIndex = Array.from(items).indexOf(document.activeElement);
		const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : items.length - 1;
		items[prevIndex]?.focus();
	}

	// Auto-focus first item when menu opens
	$effect(() => {
		if (open && menuElement && isPositioned) {
			const firstItem = menuElement.querySelector('[role="menuitem"]:not([aria-disabled="true"])');
			firstItem?.focus();
		}
	});

	function handleItemClick(item) {
		if (item.onclick) {
			item.onclick();
		} else if (item.action) {
			onSelect?.(item);
		}
		onClose?.();
	}

	// Filter visible items
	const visibleItems = $derived(items.filter((item) => item.visible !== false));
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		bind:this={menuElement}
		role="menu"
		class="fixed bg-bg-secondary border border-border rounded-lg shadow-xl py-1 overflow-hidden transition-opacity"
		style:left="{adjustedPosition.x}px"
		style:top="{adjustedPosition.y}px"
		style:min-width={minWidth}
		style:max-width={maxWidth}
		style:z-index={zIndex}
		style:opacity={isPositioned ? '1' : '0'}
	>
		{#each visibleItems as item (item.id)}
			{#if item.divider}
				<ContextMenuDivider />
			{:else}
				<ContextMenuItem
					label={item.label}
					icon={item.icon}
					variant={item.variant}
					disabled={item.disabled}
					submenu={item.submenu}
					{onSelect}
					onClose={onClose}
					onclick={() => handleItemClick(item)}
				/>
			{/if}
		{/each}
	</div>
{/if}
