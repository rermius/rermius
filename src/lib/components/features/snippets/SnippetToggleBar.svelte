<script>
	import { PanelRightOpen } from 'lucide-svelte';

	const { onexpand = () => {} } = $props();
</script>

<div class="flex flex-col shrink-0 mr-2">
	<button
		type="button"
		onclick={onexpand}
		class="p-2 bg-bg-secondary rounded-xl hover:bg-bg-hover transition-colors cursor-pointer group"
		title="Show snippets"
	>
		<PanelRightOpen
			size={16}
			class="text-text-tertiary group-hover:text-text-primary transition-colors"
		/>
	</button>
</div>
