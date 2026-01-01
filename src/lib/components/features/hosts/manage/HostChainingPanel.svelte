<script>
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import PanelLayout from '$lib/components/layout/PanelLayout.svelte';
	import { Input, Button, ScrollArea } from '$lib/components/ui';
	import { getConnectionIcon } from '$lib/utils/connection-icons.js';
	import { ChevronLeft } from 'lucide-svelte';

	const {
		open = false,
		// array of upstream hostIds
		chainIds = [],
		// full hosts array from store
		hosts = [],
		// current host being created/edited (may be null)
		currentHost = null,
		onchangeChain,
		onclose
	} = $props();

	let localChainIds = $state([]);
	let search = $state('');

	// Sync local state when props change / panel opens
	$effect(() => {
		if (open) {
			localChainIds = Array.isArray(chainIds) ? [...chainIds] : [];
		}
	});

	const upstreamHosts = $derived(
		(localChainIds || []).map(id => (hosts || []).find(h => h.id === id)).filter(Boolean)
	);

	const lastTargetLabel = $derived(
		(() => {
			if (upstreamHosts.length > 0) {
				const last = upstreamHosts[upstreamHosts.length - 1];
				return last.label || last.hostname || 'Host';
			}

			if (currentHost) {
				return currentHost.label || currentHost.hostname || 'Current host';
			}

			return 'host';
		})()
	);

	const filteredHosts = $derived(
		(() => {
			const term = search.trim().toLowerCase();
			const excludeIds = new Set([...(localChainIds || []), currentHost?.id].filter(Boolean));

			return (hosts || []).filter(host => {
				if (excludeIds.has(host.id)) return false;

				if (!term) return true;
				const haystack = `${host.label || ''} ${host.hostname || ''}`.toLowerCase();
				return haystack.includes(term);
			});
		})()
	);

	function handleAddToChain(hostId) {
		if (!hostId) return;
		if ((localChainIds || []).includes(hostId)) return;
		localChainIds = [...(localChainIds || []), hostId];
	}

	function handleRemoveFromChain(hostId) {
		localChainIds = (localChainIds || []).filter(id => id !== hostId);
	}

	function handleClear() {
		localChainIds = [];
	}

	function handleSave() {
		onchangeChain?.(localChainIds);
		onclose?.();
	}

	function handleClose() {
		onclose?.();
	}
</script>

{#if open}
	<div class="absolute inset-0 z-20 flex justify-end pointer-events-none">
		<div
			class="h-full bg-(--color-bg-tertiary) shadow-xl border-l border-border w-[350px] pointer-events-auto"
			transition:slide={{ duration: 220, easing: quintOut, axis: 'x' }}
		>
			<PanelLayout headerLeft={header} {content} {footer} />
		</div>
	</div>
{/if}

{#snippet header()}
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="rounded-lg text-white/80 mb-1"
				onclick={handleClose}
				aria-label="Back"
			>
				<ChevronLeft size={16} />
			</button>
			<div class="flex flex-col">
				<span class="text-sm font-semibold text-white">Edit Chain</span>
			</div>
		</div>

		<Button variant="success" size="sm" onclick={handleSave}>Save</Button>
	</div>
{/snippet}

{#snippet content()}
	<div class="flex flex-col gap-6">
		<!-- Current chain preview (upstream hosts + current host) -->
		<div class="flex flex-col gap-3">
			{#if upstreamHosts.length === 0 && !currentHost}
				<p class="text-xs text-white/40 italic">
					No chain configured yet. Add a host to start chaining.
				</p>
			{/if}

			{#each upstreamHosts as host, index (host.id)}
				{@const Icon = getConnectionIcon(host.connectionType || 'ssh')}
				<div class="flex flex-col gap-2">
					<div class="flex items-center gap-2 bg-(--color-bg-tertiary) rounded-2xl px-4 py-3">
						<div
							class="flex items-center justify-center w-9 h-9 rounded-lg bg-(--color-primary)/20 shrink-0"
						>
							<Icon size={18} class="text-[#4A9FFF]" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="text-xs font-semibold text-white truncate">
								{host.label || host.hostname}
							</div>
							{#if host.hostname}
								<div class="text-[11px] text-white/60 truncate">
									{host.username || 'root'}@{host.hostname}
								</div>
							{/if}
						</div>
						<button
							type="button"
							class="flex items-center justify-center w-6 h-6 rounded-full text-white/70 hover:bg-red-500/70 hover:text-white transition-colors shrink-0"
							onclick={() => handleRemoveFromChain(host.id)}
							aria-label="Remove from chain"
						>
							<span class="text-sm leading-none">−</span>
						</button>
					</div>

					{#if index < upstreamHosts.length - 1 || currentHost}
						<div class="flex justify-center text-white/30 text-lg">
							<span>↓</span>
						</div>
					{/if}
				</div>
			{/each}

			{#if currentHost}
				{@const CurrentIcon = getConnectionIcon(currentHost.connectionType || 'ssh')}
				<div class="flex flex-col gap-2">
					<div
						class="flex items-center gap-2 bg-(--color-bg-tertiary) rounded-2xl px-4 py-3 opacity-80"
					>
						<div
							class="flex items-center justify-center w-9 h-9 rounded-lg bg-(--color-primary)/20 shrink-0"
						>
							<CurrentIcon size={18} class="text-[#4A9FFF]" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="text-xs font-semibold text-white truncate">
								{currentHost.label || currentHost.hostname || 'Current host'}
							</div>
							{#if currentHost.hostname}
								<div class="text-[11px] text-white/60 truncate">
									{currentHost.username || 'root'}@{currentHost.hostname}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Host picker with search -->
		<div class="flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold text-white/70">Available Hosts</span>
				<span class="text-[11px] text-white/40">
					{filteredHosts.length} result{filteredHosts.length === 1 ? '' : 's'}
				</span>
			</div>

			<Input placeholder="Search hosts..." bind:value={search} />

			<ScrollArea class="max-h-64">
				<div class="flex flex-col gap-2 pr-1">
					{#if filteredHosts.length === 0}
						<p class="text-[11px] text-white/40 italic">No hosts match your search.</p>
					{:else}
						{#each filteredHosts as host (host.id)}
							{@const HostIcon = getConnectionIcon(host.connectionType || 'ssh')}
							<button
								type="button"
								class="w-full flex items-center gap-2 bg-(--color-bg-tertiary) hover:bg-(--color-bg-hover) rounded-xl px-3 py-2 text-left"
								onclick={() => handleAddToChain(host.id)}
							>
								<div
									class="flex items-center justify-center w-8 h-8 rounded-lg bg-(--color-primary)/20 shrink-0"
								>
									<HostIcon size={18} class="text-[#4A9FFF]" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="text-xs font-semibold text-white truncate">
										{host.label || host.hostname}
									</div>
									{#if host.hostname}
										<div class="text-[11px] text-white/60 truncate">
											{host.username || 'root'}@{host.hostname}
										</div>
									{/if}
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</ScrollArea>
		</div>
	</div>
{/snippet}

{#snippet footer()}
	<Button variant="danger" fullWidth onclick={handleClear}>Clear</Button>
{/snippet}
