<!--
@component RemoteTerminal
Remote terminal component for SSH/SFTP/FTP connections.
Connects to remote servers and provides interactive shell access.

@example
```svelte
<RemoteTerminal
  sessionId="ssh-session-123"
  active={true}
  homeDirectory="/home/user"
/>
```

@prop {string} sessionId - Existing session ID from backend
@prop {boolean} [active=false] - Whether this terminal is currently active
@prop {string|null} [homeDirectory=null] - Initial directory to cd into after connection
@prop {boolean} [isLocal=false] - Whether this is a local terminal (vs SSH)
@prop {string|null} [hostId=null] - Host ID for loading custom terminal settings
-->
<script>
	import { onMount } from 'svelte';
	import { useXtermTerminal } from '$lib/composables';
	const props = $props();
	const { active = false, isLocal = false, hostId = null } = props;

	let terminalContainer;

	const terminal = useXtermTerminal({
		mode: isLocal ? 'local' : 'ssh',
		get sessionId() {
			return props.sessionId;
		},
		get homeDirectory() {
			return props.homeDirectory ?? null;
		}
	});

	onMount(async () => {
		if (!terminalContainer || !props.sessionId) return;

		try {
			await terminal.initialize(terminalContainer, { hostId });
			terminal.focus();
		} catch (error) {
			console.error('Failed to initialize terminal session:', error);
		}
	});

	$effect(() => {
		if (active && terminal.terminal) {
			terminal.focus();
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
	}
</style>
