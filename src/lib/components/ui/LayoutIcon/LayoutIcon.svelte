<script>
	import { LayoutGrid, List, ChevronDown, Check } from 'lucide-svelte';

	/**
	 * @typedef {'grid' | 'list'} LayoutMode
	 */

	let { layoutMode = $bindable('grid') } = $props();

	let isOpen = $state(false);
	let dropdownElement;

	const layoutOptions = [
		{ value: 'grid', label: 'Grid view', icon: LayoutGrid },
		{ value: 'list', label: 'List view', icon: List }
	];

	function selectLayout(value) {
		layoutMode = value;
		isOpen = false;
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function handleClickOutside(event) {
		if (isOpen && dropdownElement && !dropdownElement.contains(event.target)) {
			isOpen = false;
		}
	}

	const currentOption = $derived(layoutOptions.find(o => o.value === layoutMode) || layoutOptions[0]);
	const CurrentIcon = $derived(currentOption.icon);
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={dropdownElement}>
	<!-- Layout Icon Button -->
	<button
		type="button"
		onclick={toggleDropdown}
		class="p-2 rounded-lg transition-colors border border-transparent hover:border-[var(--color-tab-active-text)] flex items-center gap-1.5 {isOpen
			? 'bg-(--color-bg-hover) border-[var(--color-tab-active-text)] text-[var(--color-tab-active-text)]'
			: 'bg-(--color-bg-secondary) hover:bg-(--color-bg-hover) text-text-primary hover:text-[var(--color-tab-active-text)]'}"
		title="Switch layout"
	>
		<CurrentIcon size={16} class={isOpen ? 'text-[var(--color-tab-active-icon)]' : ''} />
		<ChevronDown
			size={14}
			class="transition-transform {isOpen ? 'rotate-180' : ''} {isOpen
				? 'text-[var(--color-tab-active-icon)]'
				: ''}"
		/>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute right-0 top-full mt-2 z-50 w-40 bg-bg-secondary border border-border rounded-lg shadow-xl py-1"
		>
			{#each layoutOptions as option (option.value)}
				{@const Icon = option.icon}
				<button
					type="button"
					onclick={() => selectLayout(option.value)}
					class="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left hover:bg-bg-hover transition-colors {layoutMode === option.value
						? 'text-text-primary'
						: 'text-text-secondary'}"
				>
					<div class="flex items-center gap-2">
						<Icon size={14} class="text-text-secondary" />
						<span>{option.label}</span>
					</div>
					{#if layoutMode === option.value}
						<Check size={14} class="text-[var(--color-tab-active-icon)]" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
