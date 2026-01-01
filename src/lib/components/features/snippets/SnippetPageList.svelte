<script>
	import { ItemCard } from '$lib/components/ui/Card';
	import { snippetsStore } from '$lib/services';

	let {
		editingSnippet = null,
		searchQuery = '',
		selectedLabels = [],
		onadd,
		onedit,
		onremove,
		oncontextmenu,
		layoutMode = 'grid',
		sortMode = 'newest'
	} = $props();

	const snippets = $derived($snippetsStore.snippets || []);

	// Sort function based on sortMode
	function sortItems(items, mode) {
		return [...items].sort((a, b) => {
			switch (mode) {
				case 'a-z':
					return (a.name || '').localeCompare(b.name || '');
				case 'z-a':
					return (b.name || '').localeCompare(a.name || '');
				case 'oldest': {
					const dateA = new Date(a.metadata?.createdAt || 0);
					const dateB = new Date(b.metadata?.createdAt || 0);
					return dateA - dateB;
				}
				case 'newest':
				default: {
					const dateA = new Date(a.metadata?.updatedAt || a.metadata?.createdAt || 0);
					const dateB = new Date(b.metadata?.updatedAt || b.metadata?.createdAt || 0);
					return dateB - dateA;
				}
			}
		});
	}

	// Filter and sort logic
	const filteredSnippets = $derived.by(() => {
		let filtered = snippets;

		// Filter by search query
		if (searchQuery?.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				s => s.name?.toLowerCase().includes(query) || s.command?.toLowerCase().includes(query)
			);
		}

		// Filter by tags
		if (selectedLabels.length > 0) {
			filtered = filtered.filter(s => {
				const snippetLabels = s.labels || [];
				return selectedLabels.some(tag => snippetLabels.includes(tag));
			});
		}

		// Sort based on sortMode
		return sortItems(filtered, sortMode);
	});
</script>

<div class={layoutMode === 'grid' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1'}>
	<!-- Add New Snippet Card -->
	<ItemCard
		label="Add a snippet..."
		subtitle=""
		icon="code-filled"
		isAddNew
		variant={layoutMode === 'list' ? 'list' : 'card'}
		onclick={onadd}
	/>

	<!-- Existing Snippets -->
	{#each filteredSnippets as snippet (snippet.id)}
		<div class={layoutMode === 'grid' ? '' : 'w-full'}>
			<ItemCard
				label={snippet.name}
				subtitle={snippet.command?.substring(0, 50) || 'No command'}
				icon="code-filled"
				showEdit={true}
				variant={layoutMode === 'list' ? 'list' : 'card'}
				isActive={editingSnippet?.id === snippet.id}
				onedit={() => onedit(snippet)}
				oncontextmenu={(pos) => oncontextmenu?.(snippet, pos)}
			>
				<!-- Tags display -->
				{#if snippet.labels && snippet.labels.length > 0}
					<div class="flex flex-wrap gap-1 mt-1">
						{#each snippet.labels as tag (tag)}
							<span
								class="px-1.5 py-0.5 text-[10px] bg-bg-tertiary text-text-secondary rounded border border-border"
							>
								{tag}
							</span>
						{/each}
					</div>
				{/if}
			</ItemCard>
		</div>
	{/each}
</div>
