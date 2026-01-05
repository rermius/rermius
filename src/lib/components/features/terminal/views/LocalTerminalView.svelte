<!--
@component LocalTerminalView
Manages multiple local terminal sessions with tab switching.
Displays terminal instances with integrated snippet sidebar.

@example
```svelte
<LocalTerminalView />
```

Features:
- Multiple local terminal instances
- Tab-based terminal switching
- Integrated snippet sidebar
- Auto-creates initial terminal on mount
- Terminal creation is handled by terminal-manager service
-->
<script>
	import { terminalStore } from '$lib/stores';
	import { TerminalComponent } from '../core';
	import { TerminalTabBar } from '../tabs';
	import { SnippetSidebar } from '$lib/components/features/snippets';

	const sessions = $derived($terminalStore.sessions);
	const activeSessionId = $derived($terminalStore.activeSessionId);

	// Snippet panel collapse state
	let snippetCollapsed = $state(false);
</script>

<div class="flex flex-col h-full overflow-hidden" style="background-color: var(--terminal-bg)">
	<!-- Tabs -->
	<TerminalTabBar />

	<!-- Terminal with Snippet Sidebar -->
	<div class="flex-1 flex min-h-0 overflow-hidden" style="background-color: var(--terminal-bg)">
		<!-- Terminal -->
		<div class="flex-1 relative min-w-0 overflow-hidden">
			{#each sessions as session (session.id)}
				<div class="absolute inset-0" class:hidden={session.id !== activeSessionId}>
					<TerminalComponent
						sessionId={session.id}
						active={session.id === activeSessionId}
					/>
				</div>
			{/each}
		</div>
		<!-- Snippet Sidebar -->
		<SnippetSidebar
			sessionId={activeSessionId}
			collapsed={snippetCollapsed}
			ontoggle={() => (snippetCollapsed = !snippetCollapsed)}
		/>
	</div>
</div>
