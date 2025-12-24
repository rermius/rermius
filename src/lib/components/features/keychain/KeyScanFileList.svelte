<!--
@component KeyScanFileList
Displays scrollable list of files with search and select all functionality
-->
<script>
	import { ScanListHeader, ScrollArea } from '$lib/components/ui';
	import KeyScanFileItem from './KeyScanFileItem.svelte';

	let {
		files = [],
		selectedFiles = new Set(),
		searchQuery = '',
		previewTypes = new Map(),
		warnings = new Set(),
		onToggle,
		onToggleAll
	} = $props();

	// Filter files based on search query
	const filteredFiles = $derived.by(() => {
		if (!searchQuery || !searchQuery.trim()) {
			return files;
		}

		const query = searchQuery.toLowerCase();
		return files.filter(file => {
			const nameMatch = file.name.toLowerCase().includes(query);
			const pathMatch = file.path.toLowerCase().includes(query);
			return nameMatch || pathMatch;
		});
	});

	// Check if all files are selected
	const allSelected = $derived(
		filteredFiles.length > 0 && filteredFiles.every(f => selectedFiles.has(f.path))
	);

	// Selected count
	const selectedCount = $derived(filteredFiles.filter(f => selectedFiles.has(f.path)).length);
</script>

<div class="flex flex-col gap-3">
	<ScanListHeader
		bind:searchQuery
		placeholder="Search files..."
		{allSelected}
		{selectedCount}
		totalCount={filteredFiles.length}
		selectLabel="Select All"
		{onToggleAll}
		showCounts={true}
	/>

	<!-- File List -->
	<ScrollArea class="flex-1 max-h-[400px]">
		{#if filteredFiles.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<p class="text-sm text-text-secondary">
					{#if searchQuery}
						No files match your search.
					{:else}
						No files found.
					{/if}
				</p>
			</div>
		{:else}
			<div class="flex flex-col gap-1">
				{#each filteredFiles as file (file.path)}
					<KeyScanFileItem
						{file}
						selected={selectedFiles.has(file.path)}
						previewType={previewTypes.get(file.path) || null}
						hasWarning={warnings.has(file.path)}
						{onToggle}
					/>
				{/each}
			</div>
		{/if}
	</ScrollArea>
</div>
