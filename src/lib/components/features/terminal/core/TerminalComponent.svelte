<!--
@component TerminalComponent
Unified terminal component for all session types (local, SSH, telnet).
Automatically detects session type from backend and renders appropriately.

@prop {string} sessionId - Terminal session ID (from backend)
@prop {boolean} [active=false] - Whether this terminal is currently visible/active
@prop {string|null} [homeDirectory=null] - Initial directory to cd into (SSH only)
@prop {string|null} [hostId=null] - Host ID for loading terminal theme/font settings (SSH only)
-->
<script>
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { useXtermTerminal } from '$lib/composables';
	import { terminalStore } from '$lib/stores';

	const props = $props();
	const { active = false, hostId = null } = props;

	let terminalContainer;

	// Create terminal composable (session type auto-detected)
	const terminal = useXtermTerminal({
		get sessionId() {
			return props.sessionId;
		},
		get homeDirectory() {
			return props.homeDirectory ?? null;
		},
		hostId
	});

	// Initialize terminal on mount
	onMount(async () => {
		if (!terminalContainer || !props.sessionId) {
			console.warn('[TerminalComponent] Missing container or sessionId');
			return;
		}

		try {
			await terminal.initialize(terminalContainer, { hostId });
			terminal.focus();
		} catch (error) {
			console.error('[TerminalComponent] Failed to initialize:', error);
		}
	});

	// Auto-focus and repaint when terminal becomes active
	$effect(() => {
		if (active && terminal.terminal) {
			terminal.focus();

			// Force repaint when becoming visible - ensures theme changes while hidden get applied
			setTimeout(() => {
				const sessions = get(terminalStore).sessions;
				const session = sessions.find(s => s.id === props.sessionId);
				if (session?.fitAddon) {
					session.fitAddon.fit();
				}
			}, 100);
		}
	});
</script>

<div class="terminal-wrapper">
	<div bind:this={terminalContainer} class="terminal-container"></div>
</div>

<style>
	.terminal-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.terminal-container {
		width: 100%;
		height: 100%;
		padding: 0px 8px;
		box-sizing: border-box;
		overflow: hidden;
		background: var(--terminal-bg, #1e1e2e);
	}

	/* Hide xterm.js scrollbar (we use terminal's own scrolling) */
	.terminal-container :global(.xterm-viewport) {
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE/Edge */
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar) {
		display: none; /* Chrome/Safari */
	}
</style>
