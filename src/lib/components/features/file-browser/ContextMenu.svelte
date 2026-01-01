<script>
	import { adjustDropdownPosition } from '$lib/utils/dropdown-position';

	let {
		open = $bindable(false),
		position = { x: 0, y: 0 },
		items = [],
		onItemClick,
		onClose
	} = $props();

	let menuRef = $state(null);

	$effect(() => {
		if (open && menuRef && position) {
			const adjusted = adjustDropdownPosition(menuRef, position.x, position.y);
			if (adjusted.x !== position.x || adjusted.y !== position.y) {
				position = adjusted;
			}
		}
	});
	function handleItemClick(item) {
		if (item.disabled) return;
		onItemClick?.(item);
		open = false;
	}

	function handleBackdropClick() {
		open = false;
		onClose?.();
	}
</script>

{#if open && items.length > 0}
	<div class="context-menu-container">
		<!-- Backdrop -->
		<button
			type="button"
			class="fixed inset-0 bg-transparent border-none p-0 cursor-default"
			style="z-index: var(--z-modal-backdrop);"
			onclick={handleBackdropClick}
			oncontextmenu={e => {
				e.preventDefault();
				handleBackdropClick();
			}}
			aria-label="Close context menu"
		></button>

		<!-- Context Menu -->
		<div
			bind:this={menuRef}
			class="fixed bg-(--color-bg-tertiary) border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
			style="left: {position.x}px; top: {position.y}px; z-index: var(--z-popover);"
			oncontextmenu={e => e.preventDefault()}
			role="menu"
			tabindex="-1"
		>
			{#each items as item, index (index)}
				{#if item.id === 'separator'}
					<div class="h-px bg-border my-1"></div>
				{:else}
					{@const Icon = item.icon}
					<button
						type="button"
						class="w-full px-3 py-2 flex items-center gap-2 text-sm text-white/80 hover:bg-border hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed {item.danger
							? 'text-red-400 hover:text-red-300'
							: ''}"
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
