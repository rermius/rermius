<!--
@component ConnectionProgressBar
Visual timeline for connection status states.

Uses connection context from parent - no props needed for connection state.
-->
<script>
	import { Zap } from 'lucide-svelte';
	import { useConnectionContext } from './connectionContext.svelte.js';

	// Get state from context instead of props
	const ctx = useConnectionContext();

	const connectionState = $derived(ctx.connectionState);
	const shouldShow = $derived(ctx.showProgress);
</script>

<div class="progress-container">
	<div class="progress-track"></div>

	<div
		class="progress-bar"
		class:show={shouldShow}
		class:connecting={connectionState === 'CONNECTING'}
		class:connected={connectionState === 'CONNECTED'}
		class:failed={connectionState === 'FAILED'}
	></div>

	<div
		class="progress-node left"
		class:connecting={connectionState === 'CONNECTING'}
		class:connected={connectionState === 'CONNECTED'}
		class:failed={connectionState === 'FAILED'}
	>
		<Zap size={14} />
	</div>

	<div
		class="progress-node right"
		class:connecting={connectionState === 'CONNECTING'}
		class:connected={connectionState === 'CONNECTED'}
		class:failed={connectionState === 'FAILED'}
	>
		<span class="terminal-icon">&gt;_</span>
	</div>
</div>

<style>
	.progress-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 2.1rem;
		margin-bottom: 1.05rem;
	}

	.progress-track {
		position: absolute;
		top: 50%;
		left: 0;
		width: 100%;
		height: 2.8px;
		background-color: #3e4257;
		transform: translateY(-50%);
		border-radius: 9999px;
	}

	.progress-bar {
		position: absolute;
		top: 50%;
		left: 0;
		height: 2.8px;
		width: 0;
		transform: translateY(-50%);
		border-radius: 9999px;
		transition:
			width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			background-color 0.15s ease;
	}

	.progress-bar.show.connected {
		width: 100%;
		background-color: #22c55e;
	}

	.progress-bar.show.failed {
		width: 100%;
		background-color: #ef4444;
	}

	.progress-node {
		position: relative;
		z-index: 10;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		transition: all 0.3s ease;
	}

	.progress-node.left.connecting {
		background-color: #3b82f6;
		box-shadow: 0 0 0 2.8px rgba(59, 130, 246, 0.4);
		animation: spin-pulse 1.5s ease-in-out infinite;
	}

	.progress-node.left.connected {
		background-color: #22c55e;
	}

	.progress-node.left.failed {
		background-color: #ef4444;
	}

	.progress-node.right.connecting {
		background-color: #4b5563;
	}

	.progress-node.right.connected {
		background-color: #22c55e;
	}

	.progress-node.right.failed {
		background-color: #ef4444;
	}

	.terminal-icon {
		font-size: 0.79rem;
		font-family: monospace;
		font-weight: bold;
	}

	@keyframes spin-pulse {
		0% {
			transform: rotate(0deg) scale(1);
			box-shadow: 0 0 0 2.8px rgba(59, 130, 246, 0.4);
		}
		50% {
			transform: rotate(180deg) scale(1.1);
			box-shadow: 0 0 0 5.6px rgba(59, 130, 246, 0.2);
		}
		100% {
			transform: rotate(360deg) scale(1);
			box-shadow: 0 0 0 2.8px rgba(59, 130, 246, 0.4);
		}
	}
</style>
