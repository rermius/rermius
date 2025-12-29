<script>
	import { ArrowDownAZ, ArrowUpZA, CalendarArrowDown, CalendarArrowUp, Check, ChevronDown } from 'lucide-svelte';

	/**
	 * @typedef {'a-z' | 'z-a' | 'newest' | 'oldest'} SortMode
	 */

	let { sortMode = $bindable('newest') } = $props();

	let isOpen = $state(false);
	let dropdownElement;

	const sortOptions = [
		{ value: 'a-z', label: 'A-z', icon: ArrowDownAZ },
		{ value: 'z-a', label: 'Z-a', icon: ArrowUpZA },
		{ value: 'newest', label: 'Newest to oldest', icon: CalendarArrowDown },
		{ value: 'oldest', label: 'Oldest to newest', icon: CalendarArrowUp }
	];

	function selectSort(value) {
		sortMode = value;
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

	const currentOption = $derived(sortOptions.find(o => o.value === sortMode) || sortOptions[2]);
	const CurrentIcon = $derived(currentOption.icon);
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={dropdownElement}>
	<!-- Sort Icon Button -->
	<button
		type="button"
		onclick={toggleDropdown}
		class="p-2 rounded-lg transition-colors border border-transparent hover:border-[var(--color-tab-active-text)] flex items-center gap-1.5 {isOpen
			? 'bg-(--color-bg-hover) border-[var(--color-tab-active-text)] text-[var(--color-tab-active-text)]'
			: 'bg-(--color-bg-secondary) hover:bg-(--color-bg-hover) text-text-primary hover:text-[var(--color-tab-active-text)]'}"
		title="Sort items"
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
			class="absolute right-0 top-full mt-2 z-50 w-48 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 overflow-hidden"
		>
			{#each sortOptions as option, index (option.value)}
				{@const Icon = option.icon}
				{#if index === 2}
					<!-- Divider before date options -->
					<div class="border-t border-border my-1"></div>
				{/if}
				<button
					type="button"
					onclick={() => selectSort(option.value)}
					class="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-bg-hover transition-colors {sortMode === option.value
						? 'text-text-primary'
						: 'text-text-secondary'}"
				>
					<div class="flex items-center gap-2">
						<Icon size={14} class="text-text-tertiary" />
						<span>{option.label}</span>
					</div>
					{#if sortMode === option.value}
						<Check size={14} class="text-[var(--color-tab-active-icon)]" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
