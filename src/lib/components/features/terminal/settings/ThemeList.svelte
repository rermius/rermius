<script>
	import { ScrollArea } from '$lib/components/ui';

	const { themes = [], selectedId = null, onSelect } = $props();
</script>

<ScrollArea class="flex-1">
	<div class="theme-list space-y-2 pr-2">
	{#each themes as theme (theme.id)}
		<button
			class="theme-item w-full flex items-center gap-3 p-3 rounded transition-colors border
             {theme.id === selectedId
				? 'bg-bg-tertiary border-active'
				: 'bg-bg-secondary border-border hover:bg-bg-hover'}"
			onclick={() => onSelect(theme.id)}
		>
			<!-- Color Preview -->
			<div class="theme-colors flex gap-1">
				<span
					class="w-4 h-4 rounded"
					style="background: {theme.colors.background}"
					title="Background"
				></span>
			</div>

			<!-- Theme Name -->
			<span class="flex-1 text-left text-text-primary text-sm">{theme.name}</span>

			<!-- Selected Check -->
			{#if theme.id === selectedId}
				<svg class="w-5 h-5 text-active" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
			{/if}
		</button>
	{/each}
	</div>
</ScrollArea>
