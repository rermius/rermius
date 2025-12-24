<!--
@component TerminalTabItem
Individual tab item component representing a single terminal session.
Displays session title and close button with active/inactive states.

@example
```svelte
<TerminalTabItem
  session={{ id: 'term-1', title: 'Terminal 1' }}
  active={true}
/>
```

@prop {Object} session - Terminal session object
@prop {string} session.id - Unique session identifier
@prop {string} session.title - Display title for the tab
@prop {boolean} [active=false] - Whether this tab is currently active

Features:
- Click to activate terminal session
- Close button with confirmation
- Active state styling (background color from CSS variables)
- Keyboard accessible close button (Enter key)
- Proper cleanup on close (closes backend session)
-->
<script>
	import { terminalStore } from '$lib/stores';
	import { terminalCommands } from '$lib/services';

	const { session, active = false } = $props();

	function handleClick() {
		terminalStore.setActiveSession(session.id);
	}

	async function handleClose(e) {
		e.stopPropagation();

		// Cleanup frontend terminal
		if (session?.cleanup && typeof session.cleanup === 'function') {
			try {
				await session.cleanup();
			} catch (error) {
				console.error('Error cleaning up frontend terminal:', error);
			}
		}

		// Close backend terminal session
		if (session?.id) {
			try {
				await terminalCommands.closeTerminal(session.id);
			} catch (error) {
				console.error('Error closing terminal backend:', error);
			}
		}

		// Remove from store
		terminalStore.removeSession(session.id);
	}
</script>

<button
	class="terminal-tab flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-t-lg {active
		? 'text-white border-b-2 border-blue-500'
		: 'bg-[#282B3D] text-gray-400 hover:bg-[#2a2e40] hover:text-white'}"
	style={active ? 'background-color: var(--terminal-bg)' : ''}
	onclick={handleClick}
>
	<span>{session.title}</span>
	<span
		role="button"
		tabindex="0"
		class="close-btn ml-1 p-1 hover:bg-border rounded transition-colors cursor-pointer"
		onclick={handleClose}
		onkeydown={e => e.key === 'Enter' && handleClose(e)}
		aria-label="Close tab"
	>
		<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M9 3L3 9M3 3L9 9"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</span>
</button>
