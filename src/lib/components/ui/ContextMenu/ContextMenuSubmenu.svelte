<script>
	import ContextMenuItem from './ContextMenuItem.svelte';

	const { items = [], parentElement = null, onSelect, onClose } = $props();

	let submenuElement = $state(null);
	let position = $state({ x: 0, y: 0 });
	let isPositioned = $state(false);

	// Calculate submenu position relative to parent
	$effect(() => {
		if (parentElement && submenuElement) {
			const parentRect = parentElement.getBoundingClientRect();
			const submenuRect = submenuElement.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Default: position to right of parent
			let x = parentRect.right + 4;
			let y = parentRect.top;

			// Check right overflow - flip to left if needed
			if (x + submenuRect.width > viewportWidth) {
				x = parentRect.left - submenuRect.width - 4;
			}

			// Check bottom overflow
			if (y + submenuRect.height > viewportHeight) {
				y = Math.max(8, viewportHeight - submenuRect.height - 8);
			}

			// Check top overflow
			if (y < 8) {
				y = 8;
			}

			position = { x, y };
			isPositioned = true;
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
	const visibleItems = $derived(items.filter(item => item.visible !== false));
</script>

<div
	bind:this={submenuElement}
	role="menu"
	class="fixed bg-bg-secondary border border-border rounded-lg shadow-xl py-1 overflow-hidden"
	style:left="{position.x}px"
	style:top="{position.y}px"
	style:min-width="160px"
	style:max-width="220px"
	style:z-index="var(--z-popover)"
	style:opacity={isPositioned ? '1' : '0'}
>
	{#each visibleItems as item (item.id)}
		<ContextMenuItem
			label={item.label}
			icon={item.icon}
			variant={item.variant}
			disabled={item.disabled}
			onclick={() => handleItemClick(item)}
		/>
	{/each}
</div>
