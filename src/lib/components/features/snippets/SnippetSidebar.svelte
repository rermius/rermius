<script>
	import { snippetsStore } from '$lib/services';
	import { terminalStore } from '$lib/stores';
	import { useSnippetExecution } from '$lib/composables/useSnippetExecution.svelte.js';
	import { SNIPPET_SIDEBAR_WIDTH, SNIPPET_TABS } from '$lib/constants/snippet-ui.js';
	import { Modal, TagFilter } from '$lib/components/ui';
	import SnippetSidebarHeader from './SnippetSidebarHeader.svelte';
	import SnippetSidebarList from './SnippetSidebarList.svelte';
	import SnippetToggleBar from './SnippetToggleBar.svelte';
	import HistoryList from './HistoryList.svelte';
	import SnippetPanel from './SnippetPanel.svelte';

	let {
		sessionId: propSessionId = null,
		collapsed = false,
		ontoggle = () => {}
	} = $props();

	let activeTab = $state(SNIPPET_TABS.CODE);
	let showSnippetModal = $state(false);
	let editingSnippet = $state(null);
	let selectedTags = $state([]);

	// Get snippets from store (already loaded in root layout)
	const snippets = $derived($snippetsStore.snippets || []);

	// Get all tags reactively from snippets store
	const allTags = $derived.by(() => {
		const allLabels = snippets.flatMap(s => s.labels || []);
		return [...new Set(allLabels)].sort();
	});

	// Get active terminal session - use prop if provided, otherwise fallback to store
	const activeSessionId = $derived(propSessionId || $terminalStore.activeSessionId);

	// Use snippet execution composable - pass getter function for reactive access
	const { run, paste } = useSnippetExecution(() => activeSessionId);

	function handleNewSnippet() {
		editingSnippet = null;
		showSnippetModal = true;
	}

	function handleEditSnippet(snippet) {
		editingSnippet = snippet;
		showSnippetModal = true;
	}

	function handleSnippetSave() {
		showSnippetModal = false;
		editingSnippet = null;
	}

	function handleCloseModal() {
		showSnippetModal = false;
		editingSnippet = null;
	}
</script>

{#if collapsed}
	<SnippetToggleBar onexpand={ontoggle} />
{:else}
	<div
		class="flex flex-col h-full bg-bg-secondary rounded-xl shrink-0 mr-2"
		style="width: {SNIPPET_SIDEBAR_WIDTH}px;"
	>
		<SnippetSidebarHeader bind:activeTab oncollapse={ontoggle} />

		{#if activeTab === SNIPPET_TABS.CODE}
			<!-- Tag Filter -->
			<div class="px-3 py-2 border-b border-border">
				<TagFilter {allTags} bind:selectedTags showClearButton={true} />
			</div>
			<SnippetSidebarList {snippets} {selectedTags} onRun={run} onPaste={paste} />
		{:else if activeTab === SNIPPET_TABS.CLOCK}
			<HistoryList sessionId={activeSessionId} onPaste={paste} />
		{/if}
	</div>
{/if}
