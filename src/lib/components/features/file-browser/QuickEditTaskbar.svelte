<script>
	import { quickEditStore } from '$lib/stores/quick-edit.store';
	import { X } from 'lucide-svelte';

	const { panelId } = $props();

	// Get instances for this panel from store
	const allInstances = $derived($quickEditStore);
	const panelInstances = $derived(allInstances.filter(i => i.panelId === panelId));
	const hasInstances = $derived(panelInstances.length > 0);

	function handleTabClick(instance) {
		if (instance.state === 'minimized') {
			quickEditStore.maximize(instance.id);
		} else {
			quickEditStore.minimize(instance.id);
		}
	}

	function handleTabClose(e, instance) {
		e.stopPropagation();
		if (instance.isDirty) {
			window.dispatchEvent(
				new CustomEvent('quick-edit-close-request', { detail: { id: instance.id } })
			);
		} else {
			quickEditStore.close(instance.id);
		}
	}

	function truncatePath(path, maxLen = 40) {
		if (path.length <= maxLen) return path;
		return '...' + path.slice(-(maxLen - 3));
	}
</script>

{#if hasInstances}
	<div class="quick-edit-taskbar flex items-center gap-1 px-2 py-1 bg-bg-tertiary border-t border-border overflow-x-auto">
		{#each panelInstances as instance (instance.id)}
			<div
				class="taskbar-tab flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap max-w-[200px] cursor-pointer
					{instance.state === 'maximized'
					? 'bg-primary/20 text-primary border border-primary/30'
					: 'bg-bg-surface text-text-secondary hover:bg-border hover:text-text-primary border border-transparent'}"
				onclick={() => handleTabClick(instance)}
				onkeydown={(e) => e.key === 'Enter' && handleTabClick(instance)}
				role="tab"
				tabindex="0"
				title={instance.filePath}
			>
				{#if instance.isDirty}
					<span class="text-amber-400 text-[10px] leading-none">●</span>
				{/if}
				<span class="truncate">{truncatePath(instance.filePath)}</span>
				<button
					type="button"
					class="ml-0.5 p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
					onclick={(e) => handleTabClose(e, instance)}
					title="Close"
				>
					<X size={12} />
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.quick-edit-taskbar {
		min-height: 32px;
		scrollbar-width: thin;
	}

	.quick-edit-taskbar::-webkit-scrollbar {
		height: 4px;
	}

	.quick-edit-taskbar::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 2px;
	}
</style>
