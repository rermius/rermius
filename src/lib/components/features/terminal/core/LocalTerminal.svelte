<!--
@component LocalTerminal
Local terminal component using xterm.js for shell interaction.
Manages local terminal sessions (bash, zsh, etc.) on the host machine.

@example
```svelte
<LocalTerminal config={{ shell: '/bin/bash', title: 'My Terminal', key: 'term-1' }} />
```

@prop {Object} config - Terminal configuration
@prop {string} [config.shell] - Shell path (e.g., '/bin/bash')
@prop {string} [config.title] - Terminal title
@prop {string} [config.key] - Unique key for session tracking
-->
<script>
	import { onMount } from 'svelte';
	import { useXtermTerminal } from '$lib/composables';
	const props = $props();
	const config = $derived(props.config ?? {});

	let terminalContainer;

	const terminal = useXtermTerminal({
		mode: 'local',
		get shell() {
			return config.shell;
		},
		get title() {
			return config.title;
		}
	});

	onMount(async () => {
		if (terminalContainer) {
			await terminal.initialize(terminalContainer, { key: config.key });
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
