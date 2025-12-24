<script>
	import { Tag, X } from 'lucide-svelte';

	let {
		allTags = [],
		selectedTags = $bindable([]),
		searchQuery = $bindable(''),
		showClearButton = true
	} = $props();

	function toggleTag(tag) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter(t => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	function clearFilters() {
		searchQuery = '';
		selectedTags = [];
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2">
		<Tag size={14} class="text-text-tertiary" />
		<span class="text-xs text-text-tertiary uppercase tracking-wider">Filter by tags</span>
		{#if showClearButton && (selectedTags.length > 0 || searchQuery.trim())}
			<button
				type="button"
				onclick={clearFilters}
				class="ml-auto text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
			>
				<X size={12} />
				<span>Clear</span>
			</button>
		{/if}
	</div>
	{#if allTags.length > 0}
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
	{:else}
		<p class="text-xs text-text-tertiary">
			No tags available. Add tags to hosts to filter by them.
		</p>
	{/if}
</div>
