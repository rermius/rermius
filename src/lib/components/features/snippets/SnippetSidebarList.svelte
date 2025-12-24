<script>
	import { Code } from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';
	import SnippetItem from './SnippetItem.svelte';

	let { snippets = [], selectedTags = [], onRun, onPaste } = $props();

	// Filter snippets by selected tags
	const filteredSnippets = $derived.by(() => {
		if (selectedTags.length === 0) {
			return snippets;
		}
		return snippets.filter(s => {
			const snippetLabels = s.labels || [];
			return selectedTags.some(tag => snippetLabels.includes(tag));
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
