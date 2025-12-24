<script>
	import { ChevronUp, ChevronDown } from 'lucide-svelte';

	let { sortBy = 'name', sortOrder = 'asc', onSort } = $props();

	const columns = [
		{ key: 'name', label: 'Name', width: 'flex-1 min-w-30 max-w-[53%]', padding: 'pr-2' },
		{ key: 'modified', label: 'Date Modified', width: 'w-33 shrink-0', padding: 'pl-2' },
		{ key: 'size', label: 'Size', width: 'w-24 shrink-0', align: 'right' },
		{ key: 'kind', label: 'Kind', width: 'w-16 shrink-0', align: 'right', padding: 'pl-2' }
	];

	function handleSort(key) {
		if (sortBy === key) {
			onSort?.(key, sortOrder === 'asc' ? 'desc' : 'asc');
		} else {
			onSort?.(key, 'asc');
		}
	}
</script>

<div
	class="file-list-header flex items-center h-8 px-2 border-b border-border bg-bg-secondary text-xs text-white/60"
>
	<!-- Icon spacer -->
	<div class="w-6 shrink-0"></div>

	{#each columns as col}
		<button
			class="flex items-center gap-1 {col.width} shrink-0 hover:text-white transition-colors
				{col.align === 'right' ? 'justify-end' : ''}
				{col.padding || ''}"
			onclick={() => handleSort(col.key)}
		>
			<span>{col.label}</span>
			{#if sortBy === col.key}
				{#if sortOrder === 'asc'}
					<ChevronUp size={12} class="text-white/80" />
				{:else}
					<ChevronDown size={12} class="text-white/80" />
				{/if}
			{/if}
		</button>
	{/each}
</div>
