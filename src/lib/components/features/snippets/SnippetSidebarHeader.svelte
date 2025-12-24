<script>
	import { Code, Clock } from 'lucide-svelte';
	import { SNIPPET_TABS } from '$lib/constants/snippet-ui.js';

	let { activeTab = $bindable(SNIPPET_TABS.CODE) } = $props();
</script>

<div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={() => (activeTab = SNIPPET_TABS.CODE)}
			class="p-1.5 rounded transition-colors {activeTab === SNIPPET_TABS.CODE
				? 'text-active bg-bg-tertiary'
				: 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'}"
			title="Snippets"
		>
			<Code size={16} />
		</button>
		<button
			type="button"
			onclick={() => (activeTab = SNIPPET_TABS.CLOCK)}
			class="p-1.5 rounded transition-colors {activeTab === SNIPPET_TABS.CLOCK
				? 'text-active bg-bg-tertiary'
				: 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'}"
			title="History"
		>
			<Clock size={16} />
		</button>
	</div>
	{#if activeTab === SNIPPET_TABS.CODE}
		<button
			type="button"
			class="flex items-center gap-1.5 px-2 py-1 text-xs text-text-primary bg-bg-tertiary hover:bg-bg-hover rounded transition-colors"
		>
			<Code size={14} />
			<span>New Snippet</span>
		</button>
	{/if}
</div>
