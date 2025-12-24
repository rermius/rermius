<!--
@component ImportHostList
Lists scanned SSH config hosts with search and select all functionality
-->
<script>
	import { ScanListHeader } from '$lib/components/ui';
	import ImportHostItem from './ImportHostItem.svelte';

	let {
		hosts = [],
		selectedHosts = new Set(),
		searchQuery = $bindable(''),
		onToggleHost,
		onToggleAll
	} = $props();

	const filteredHosts = $derived.by(() => {
		if (!searchQuery || !searchQuery.trim()) {
			return hosts;
		}

		const query = searchQuery.toLowerCase();
		return hosts.filter(host => {
			const nameMatch = host.name?.toLowerCase().includes(query);
			const hostnameMatch = host.hostname?.toLowerCase().includes(query);
			const userMatch = host.user?.toLowerCase().includes(query);
			const identityMatch = host.identityFile?.toLowerCase().includes(query);
			return nameMatch || hostnameMatch || userMatch || identityMatch;
		});
	});

	const allSelected = $derived(
		filteredHosts.length > 0 && filteredHosts.every(h => selectedHosts.has(h.name))
	);

	const selectedCount = $derived(filteredHosts.filter(h => selectedHosts.has(h.name)).length);

	function handleToggleAll() {
		onToggleAll?.();
	}
</script>

<div class="flex flex-col gap-3">
	<ScanListHeader
		bind:searchQuery
		placeholder="Search hosts..."
		{allSelected}
		{selectedCount}
		totalCount={filteredHosts.length}
		selectLabel="Select All"
		onToggleAll={handleToggleAll}
		showCounts={true}
	/>

	<!-- Host List -->
	<div class="flex flex-col gap-2 overflow-y-auto">
		{#if filteredHosts.length === 0}
			<div class="text-sm text-text-secondary text-center py-8">
				{#if searchQuery}
					No hosts found matching "{searchQuery}"
				{:else}
					No hosts found in SSH config
				{/if}
			</div>
		{:else}
			{#each filteredHosts as host (host.name)}
				<ImportHostItem {host} selected={selectedHosts.has(host.name)} onToggle={onToggleHost} />
			{/each}
		{/if}
	</div>
</div>
