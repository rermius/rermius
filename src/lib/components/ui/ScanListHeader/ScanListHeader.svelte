<script>
	import { Search } from 'lucide-svelte';
	import { Checkbox } from '$lib/components/ui';

	let {
		searchQuery = $bindable(''),
		placeholder = 'Search...',
		allSelected = false,
		selectedCount = 0,
		totalCount = 0,
		selectLabel = 'Select All',
		showCounts = true,
		onToggleAll
	} = $props();

	function handleToggleAll() {
		onToggleAll?.();
	}
</script>

<div class="flex flex-col gap-3">
	<!-- Search Input -->
	<div class="relative">
		<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
		<input
			type="text"
			bind:value={searchQuery}
			{placeholder}
			class="w-full pl-9 pr-3 py-2 bg-bg-secondary border border-border text-xs text-text-secondary placeholder-text-secondary rounded-lg outline-none focus:ring-1 focus:ring-[var(--color-active)] focus:border-[var(--color-active)] transition-all"
		/>
	</div>

	<!-- Select All Row -->
	{#if totalCount > 0}
		<div class="flex items-center justify-between px-3 py-2 bg-bg-tertiary rounded-lg">
			<div class="flex items-center gap-2">
				<Checkbox checked={allSelected} onchange={handleToggleAll} />
				<button
					type="button"
					onclick={handleToggleAll}
					class="text-xs text-text-secondary hover:text-[var(--color-active)] transition-colors"
				>
					{selectLabel}
				</button>
			</div>

			{#if showCounts}
				<span class="text-xs text-text-secondary">
					{selectedCount} of {totalCount} selected
				</span>
			{/if}
		</div>
	{/if}
</div>
