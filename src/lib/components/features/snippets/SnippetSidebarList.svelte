<script>
	import { Code } from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';
	import SnippetItem from './SnippetItem.svelte';

	let { snippets = [], selectedTags = [], onRun, onPaste } = $props();

	// Filter and sort snippets by selected tags (newest first)
	const filteredSnippets = $derived.by(() => {
		let filtered = snippets;

		if (selectedTags.length > 0) {
			filtered = filtered.filter(s => {
				const snippetLabels = s.labels || [];
				return selectedTags.some(tag => snippetLabels.includes(tag));
			});
		}

		// Sort by newest first (using updatedAt or createdAt)
		return [...filtered].sort((a, b) => {
			const dateA = new Date(a.metadata?.updatedAt || a.metadata?.createdAt || 0);
			const dateB = new Date(b.metadata?.updatedAt || b.metadata?.createdAt || 0);
			return dateB - dateA;
		});
	});
</script>

<ScrollArea class="flex-1">
	<div class="flex flex-col">
		{#each filteredSnippets as snippet (snippet.id)}
			<SnippetItem {snippet} {onRun} {onPaste} />
		{/each}

		<!-- Empty State -->
		{#if filteredSnippets.length === 0}
			<div class="flex flex-col items-center justify-center py-12 px-4 text-center">
				<Code size={32} class="text-(--color-text-tertiary) mb-2" />
				<p class="text-xs text-(--color-text-secondary)">
					{selectedTags.length > 0 ? 'No snippets match the selected tags' : 'No snippets yet'}
				</p>
			</div>
		{/if}
	</div>
</ScrollArea>
