<script>
	import { X } from 'lucide-svelte';

	const {
		label = '',
		active = false,
		closeable = false,
		icon = '',
		iconComponent = null, // Lucide icon component
		tabId = '',
		bgColor = '#1e1e2e', // Default terminal color
		trailingIconComponent = null, // Optional trailing action icon
		trailingTitle = '',
		onTrailingClick = null,
		onclick,
		onkeypress,
		onclose
	} = $props();

	function handleClose(e) {
		e.stopPropagation();
		onclose?.({ tabId });
	}

	function handleMouseDown(e) {
		// Middle mouse button (button 1) closes the tab
		if (e.button === 1 && closeable) {
			e.preventDefault();
			onclose?.({ tabId });
		}
	}

	function handleTrailingClick(e) {
		e.stopPropagation();
		onTrailingClick?.({ tabId, event: e });
	}
</script>

{#if (icon || iconComponent) && !label}
	<!-- Icon-only tab -->
	<div
		class="tab-item flex items-center justify-center py-2 px-2 transition-colors cursor-pointer {active
			? 'tab-active rounded-t-2xl'
			: 'bg-(--color-bg-tertiary) hover:bg-(--color-bg-hover) rounded-lg'}"
		style:background-color={active ? bgColor : undefined}
		style:--tab-bg={bgColor}
		role="button"
		tabindex="0"
		onclick={e => onclick?.(e)}
		onkeypress={e => onkeypress?.(e)}
		onmousedown={handleMouseDown}
	>
		{#if iconComponent}
			{@const Icon = iconComponent}
			<Icon size={12} class={active ? 'text-tab-active-icon' : 'text-text-secondary'} />
		{/if}
	</div>
{:else}
	<!-- Regular tab with label -->
	<div
		class="tab-item flex rounded-lg items-center gap-1 py-1 transition-all cursor-pointer! select-none {active
			? 'tab-active'
			: 'bg-(--color-bg-tertiary) hover:bg-(--color-bg-hover)'}"
		style:padding-left={active ? 'calc(0.75rem * 2)' : '0.75rem'}
		style:padding-right={active ? 'calc(0.75rem * 2)' : '0.75rem'}
		style:background-color={active ? bgColor : undefined}
		style:--tab-bg={bgColor}
		role="button"
		tabindex="0"
		onclick={e => onclick?.(e)}
		onkeypress={e => onkeypress?.(e)}
		onmousedown={handleMouseDown}
	>
		{#if iconComponent}
			{@const Icon = iconComponent}
			<Icon size={16} class={active ? 'text-tab-active-icon' : 'text-text-secondary'} />
		{/if}
		<span class="text-sm font-medium {active ? 'text-tab-active-text' : 'text-text-secondary'}"
			>{label}</span
		>
		{#if trailingIconComponent}
			{@const TrailingIcon = trailingIconComponent}
			<button
				class="ml-1 p-1 rounded hover:bg-(--color-bg-tertiary) transition-colors {active
					? 'text-tab-active-icon'
					: 'text-text-secondary'}"
				title={trailingTitle}
				onclick={handleTrailingClick}
				onmousedown={e => e.stopPropagation()}
			>
				<TrailingIcon size={12} />
			</button>
		{/if}
		{#if closeable}
			<button
				class="ml-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer flex items-center {active
					? 'text-tab-active-icon'
					: 'text-text-secondary'}"
				onclick={handleClose}
				onmousedown={e => e.stopPropagation()}
				aria-label="Close tab"
			>
				<X size={15} />
			</button>
		{/if}
	</div>
{/if}

<style>
	.tab-item {
		position: relative;
		transition:
			padding 0.3s ease,
			background-color 0.2s ease,
			color 0.2s ease;
		flex-shrink: 0;
		white-space: nowrap;
	}

	/* Smooth curves on both sides of active tab */
	.tab-active::before,
	.tab-active::after {
		content: '';
		position: absolute;
		bottom: 0;
		width: 8px;
		height: 8px;
		background: transparent;
	}

	/* Left curve
	.tab-active::before {
		left: -8px;
		border-bottom-right-radius: 8px;
		box-shadow: 4px 4px 0 4px var(--tab-bg, var(--color-bg-primary, #1a1d29));
	}
	*/

	/* Right curve 
	.tab-active::after {
		right: -8px;
		border-bottom-left-radius: 8px;
		box-shadow: -4px 4px 0 4px var(--tab-bg, var(--color-bg-primary, #1a1d29));
	}
	*/
</style>
