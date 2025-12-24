<script>
	import HostFormBasics from './subparts/HostFormBasics.svelte';
	import HostAuthSection from './subparts/HostAuthSection.svelte';
	import HostAdvancedSection from './subparts/HostAdvancedSection.svelte';
	import HostSummary from './subparts/HostSummary.svelte';
	import HostChainingPanel from './HostChainingPanel.svelte';
	import PanelLayout from '$lib/components/layout/PanelLayout.svelte';
	import { hostsStore } from '$lib/services';
	import { createHostFormContext } from './hostFormContext.svelte.js';

	const props = $props();

	// Reactive derived values from store
	const groups = $derived($hostsStore.groups || []);
	const allHosts = $derived($hostsStore.hosts || []);
	const storeTags = $derived.by(() => {
		const currentHosts = $hostsStore.hosts || [];
		const tags = currentHosts.flatMap(h => h.tags || []);
		return [...new Set(tags)].sort();
	});

	// Create form context - provides state and handlers to all subparts
	const ctx = createHostFormContext({
		getEditingHost: () => props.editingHost ?? null,
		getGroups: () => groups,
		getAllHosts: () => allHosts,
		getStoreTags: () => storeTags,
		defaultGroupId: props.defaultGroupId ?? 'group-default',
		autoConnect: props.autoConnect ?? true,
		onsave: props.onsave
	});

	// Sync effects - run in parent component
	$effect(() => {
		ctx.initFromEditingHost(props.editingHost);
	});

	$effect(() => {
		ctx.syncDraftToStore();
	});

	$effect(() => {
		ctx.updateLocalTags(storeTags);
	});
</script>

<div class="relative h-full">
	<PanelLayout title={ctx.isEditMode ? 'Edit Host' : 'Host'} {content} {footer} />

	<HostChainingPanel
		open={ctx.isHostChainingOpen}
		chainIds={ctx.hostChainIds}
		hosts={allHosts}
		currentHost={props.editingHost}
		onchangeChain={ctx.handleHostChainChange}
		onclose={ctx.closeChaining}
	/>
</div>

{#snippet content()}
	<div class="flex flex-col gap-4">
		<!-- All subparts now use context - no props needed! -->
		<HostFormBasics />
		<HostAuthSection />
		<HostAdvancedSection />
	</div>
{/snippet}

{#snippet footer()}
	<HostSummary />
{/snippet}
