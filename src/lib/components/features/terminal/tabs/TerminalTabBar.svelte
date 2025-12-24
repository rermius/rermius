<!--
@component TerminalTabBar
Tab bar component displaying all terminal session tabs with new tab button.
Shows active/inactive states and allows tab switching.

@example
```svelte
<TerminalTabBar />
```

Features:
- Displays all terminal sessions as tabs
- Active tab highlighting
- New tab creation button
- Tab overflow scrolling
- Keyboard accessible
-->
<script>
	import { terminalStore } from '$lib/stores';
	import { TerminalTabItem } from '../tabs';

	const sessions = $derived($terminalStore.sessions);
	const activeSessionId = $derived($terminalStore.activeSessionId);

	function handleNewTab() {
		// Dispatch event to create new terminal
		window.dispatchEvent(new CustomEvent('create-terminal'));
	}
</script>

<div class="flex items-center gap-2 bg-[#282B3D] px-3 py-2 border-b bg-bg-secondary">
	<!-- Terminal tabs -->
	<div class="flex items-center gap-1 flex-1 overflow-x-auto">
		{#each sessions as session (session.id)}
			<TerminalTabItem {session} active={session.id === activeSessionId} />
		{/each}
	</div>

	<!-- New tab button -->
	<button
		class="p-1.5 hover:bg-border rounded transition-colors text-gray-400 hover:text-white"
		onclick={handleNewTab}
		aria-label="New terminal"
	>
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M8 3V13M3 8H13"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</button>
</div>
