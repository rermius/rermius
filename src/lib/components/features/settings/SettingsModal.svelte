<script>
	import { Modal } from '$lib/components/ui/Modal';
	import { Keyboard, Terminal } from 'lucide-svelte';
	import ShortcutsPanel from './ShortcutsPanel.svelte';
	import ShellPreferencesPanel from './ShellPreferencesPanel.svelte';

	let { open = $bindable(false) } = $props();

	let activePanel = $state('shortcuts');

	const panels = [
		{ id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
		{ id: 'shell', label: 'Shell Preferences', icon: Terminal }
	];

	function handleClose() {
		open = false;
	}

	function selectPanel(panelId) {
		activePanel = panelId;
	}
</script>

<Modal bind:open size="xl" closeOnEscape={true}>
	<div class="flex h-[600px]">
		<!-- Sidebar Navigation -->
		<aside class="w-56 border-r border-border bg-bg-secondary flex flex-col">
			<div class="p-4 border-b border-border">
				<h2 class="text-lg font-semibold text-text-primary">Settings</h2>
			</div>

			<nav class="flex-1 p-2">
				{#each panels as panel (panel.id)}
					{@const IconComponent = panel.icon}
					<button
						type="button"
						onclick={() => selectPanel(panel.id)}
						class="w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors
                   hover:bg-bg-hover"
						class:bg-bg-hover={activePanel === panel.id}
						class:text-accent-primary={activePanel === panel.id}
						class:text-text-primary={activePanel !== panel.id}
					>
						<IconComponent size={18} />
						{panel.label}
					</button>
				{/each}
			</nav>

			<div class="p-4 border-t border-border">
				<button
					type="button"
					onclick={handleClose}
					class="w-full px-3 py-2 bg-bg-tertiary text-text-primary rounded transition-colors
                 hover:bg-bg-hover text-sm"
				>
					Close Settings
				</button>
			</div>
		</aside>

		<!-- Panel Content -->
		<main class="flex-1 bg-bg-primary">
			{#if activePanel === 'shortcuts'}
				<ShortcutsPanel />
			{:else if activePanel === 'shell'}
				<ShellPreferencesPanel />
			{/if}
		</main>
	</div>
</Modal>
