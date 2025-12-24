<script>
	import { Tag, X, ChevronDown } from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';

	let { allTags = [], selectedTags = $bindable([]), showClearButton = true } = $props();

	let isOpen = $state(false);
	let dropdownElement;

	function toggleTag(tag) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter(t => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	function clearFilters() {
		selectedTags = [];
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function handleClickOutside(event) {
		if (isOpen && dropdownElement && !dropdownElement.contains(event.target)) {
			isOpen = false;
		}
	}

	const hasActiveFilters = $derived(selectedTags.length > 0);
	const isActive = $derived(isOpen || hasActiveFilters);
	const tagIconClass = $derived(isActive ? 'text-[var(--color-tab-active-icon)]' : '');
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={dropdownElement}>
	<!-- Tag Icon Button -->
	<button
		type="button"
		onclick={toggleDropdown}
		class="p-2 rounded-lg transition-colors border border-transparent hover:border-[var(--color-tab-active-text)] flex items-center gap-1.5 {isActive
			? 'bg-(--color-bg-hover) border-[var(--color-tab-active-text)] text-[var(--color-tab-active-text)]'
			: 'bg-(--color-bg-secondary) hover:bg-(--color-bg-hover) text-text-primary hover:text-[var(--color-tab-active-text)]'}"
		title="Filter by tags"
	>
		<Tag size={16} class={tagIconClass} />
		<ChevronDown
			size={14}
			class="transition-transform {isOpen ? 'rotate-180' : ''} {isActive
				? 'text-[var(--color-tab-active-icon)]'
				: ''}"
		/>
		{#if isActive}
			<span class="absolute -top-1 -right-1 w-2 h-2 bg-[var(--color-tab-active-text)] rounded-full"
			></span>
		{/if}
	</button>

	<!-- Dropdown -->
	{#if isOpen && allTags.length > 0}
		<div
			class="absolute right-0 top-full mt-2 z-50 w-64 bg-bg-secondary border border-border rounded-lg shadow-xl max-h-80 flex flex-col overflow-hidden"
		>
			<!-- Header -->
			<div class="p-3 border-b border-border flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Tag size={14} class="text-text-tertiary" />
					<span class="text-xs text-text-tertiary uppercase tracking-wider">Filter by tags</span>
				</div>
				{#if showClearButton && hasActiveFilters}
					<button
						type="button"
						onclick={clearFilters}
						class="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
					>
						<X size={12} />
						<span>Clear</span>
					</button>
				{/if}
			</div>

			<!-- Tags List -->
			<ScrollArea class="flex-1">
				<div class="p-2">
					<div class="flex flex-wrap gap-1.5">
						{#each allTags as tag (tag)}
							<button
								type="button"
								onclick={() => toggleTag(tag)}
								class="px-2 py-1 text-xs rounded transition-colors {selectedTags.includes(tag)
									? 'bg-(--color-active) text-white border border-(--color-active)'
									: 'bg-bg-surface text-text-secondary hover:text-text-primary border border-border hover:border-(--color-active)'}"
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>
			</ScrollArea>
		</div>
	{:else if isOpen && allTags.length === 0}
		<div
			class="absolute right-0 top-full mt-2 z-50 w-64 bg-bg-secondary border border-border rounded-lg shadow-xl p-4"
		>
			<p class="text-xs text-text-tertiary text-center">No tags available</p>
		</div>
	{/if}
</div>
