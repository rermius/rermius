<script>
	import { Code, Clock, PanelRightClose, Palette } from 'lucide-svelte';
	import { SNIPPET_TABS } from '$lib/constants/snippet-ui.js';

	let { activeTab = $bindable(SNIPPET_TABS.CODE), oncollapse = () => {} } = $props();
</script>

<div class="flex items-center justify-between gap-2 px-2 py-2 border-b border-border">
	<div class="flex items-center gap-1">
		<!-- Collapse button -->
		<button
			type="button"
			onclick={oncollapse}
			class="p-1.5 rounded transition-colors text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
			title="Hide panel"
		>
			<PanelRightClose size={16} />
		</button>

		<div class="w-px h-4 bg-border mx-1"></div>

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
		<button
			type="button"
			onclick={() => (activeTab = SNIPPET_TABS.SETTINGS)}
			class="p-1.5 rounded transition-colors {activeTab === SNIPPET_TABS.SETTINGS
				? 'text-active bg-bg-tertiary'
				: 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'}"
			title="Theme"
		>
			<Palette size={16} />
		</button>
	</div>
</div>
