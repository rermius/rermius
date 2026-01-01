<script>
	import { ChevronRight } from 'lucide-svelte';
	import ContextMenuSubmenu from './ContextMenuSubmenu.svelte';

	const {
		label = '',
		icon = null,
		variant = 'default', // 'default' | 'danger'
		disabled = false,
		hasSubmenu = false,
		submenu = null, // Array of submenu items
		onclick,
		onSelect, // For submenu item selection
		onClose // For closing parent menu
	} = $props();

	let itemElement = $state(null);
	let showSubmenu = $state(false);
	let hoverTimeout = $state(null);
	let leaveTimeout = $state(null);

	function handleClick(event) {
		if (disabled) return;
		// Don't trigger click if item has submenu
		if (!submenu) {
			onclick?.(event);
		}
	}

	function handleKeydown(event) {
		if (disabled) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (!submenu) {
				onclick?.(event);
			} else {
				// For submenu items, toggle submenu on Enter/Space
				showSubmenu = !showSubmenu;
			}
		} else if (event.key === 'ArrowRight' && submenu) {
			// Open submenu on right arrow
			showSubmenu = true;
		}
	}

	function handleMouseEnter() {
		if (disabled || !submenu) return;

		// Clear any pending leave timeout
		if (leaveTimeout) {
			clearTimeout(leaveTimeout);
			leaveTimeout = null;
		}

		// Show submenu after 200ms delay
		hoverTimeout = setTimeout(() => {
			showSubmenu = true;
		}, 200);
	}

	function handleMouseLeave() {
		if (disabled || !submenu) return;

		// Clear hover timeout
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}

		// Close submenu after 150ms delay
		leaveTimeout = setTimeout(() => {
			showSubmenu = false;
		}, 150);
	}

	function handleSubmenuMouseEnter() {
		// Cancel close timeout when entering submenu
		if (leaveTimeout) {
			clearTimeout(leaveTimeout);
			leaveTimeout = null;
		}
	}

	function handleSubmenuMouseLeave() {
		// Close submenu when leaving
		leaveTimeout = setTimeout(() => {
			showSubmenu = false;
		}, 150);
	}

	const baseStyles = 'flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors';
	const variantStyles = {
		default: disabled
			? 'text-text-disabled cursor-not-allowed opacity-50'
			: 'text-text-primary hover:bg-bg-hover cursor-pointer',
		danger: disabled
			? 'text-red-500/50 cursor-not-allowed opacity-50'
			: 'text-red-500 hover:bg-red-500/10 cursor-pointer'
	};
</script>

<div class="relative">
	<div
		bind:this={itemElement}
		role="menuitem"
		tabindex={disabled ? -1 : 0}
		onclick={handleClick}
		onkeydown={handleKeydown}
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		class="{baseStyles} {variantStyles[variant]}"
		aria-disabled={disabled}
		aria-haspopup={submenu ? 'true' : undefined}
	>
		<div class="flex items-center gap-2">
			{#if icon}
				{@const Icon = icon}
				<Icon size={16} />
			{/if}
			<span>{label}</span>
		</div>

		{#if hasSubmenu || submenu}
			<ChevronRight size={14} class="text-text-tertiary" />
		{/if}
	</div>

	{#if submenu && showSubmenu}
		<div onmouseenter={handleSubmenuMouseEnter} onmouseleave={handleSubmenuMouseLeave}>
			<ContextMenuSubmenu items={submenu} parentElement={itemElement} {onSelect} {onClose} />
		</div>
	{/if}
</div>
