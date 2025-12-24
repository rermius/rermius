<!--
@component ConnectionLogViewer
Displays connection logs and warning message.

Uses connection context from parent for connection state and logs.

@prop {boolean} [showLogs=false] - Local UI state for toggling log visibility
-->
<script>
	import { ScrollArea } from '$lib/components/ui';
	import { Info } from 'lucide-svelte';
	import { useConnectionContext } from './connectionContext.svelte.js';

	// Only showLogs is passed as prop (local UI state)
	const { showLogs = false } = $props();

	// Get connection data from context
	const ctx = useConnectionContext();

	const connectionState = $derived(ctx.connectionState);
	const connectionLogs = $derived(ctx.connectionLogs);
	const shouldShow = $derived(connectionState === 'FAILED' || showLogs);
</script>

{#if shouldShow}
	<div class="log-viewer">
		{#if connectionState === 'FAILED'}
			<h4 class="log-title">Connection failed with connection log:</h4>
		{/if}

		{#if connectionLogs.length > 0}
			<div class="log-scroll">
				<div class="log-body">
					<ScrollArea class="log-scroll-area">
						{#each connectionLogs as log, index (index)}
							<div class="log-line">{log}</div>
						{/each}
					</ScrollArea>
				</div>
			</div>
		{/if}

		{#if connectionState === 'FAILED'}
			<div class="warning-box">
				<div class="warning-row">
					<span class="warning-icon">
						<Info size={16} />
					</span>
					<span class="warning-text">Tunneling and Certificates are disabled.</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.log-viewer {
		margin-top: 1.5rem;
	}

	.log-title {
		color: #ef4444;
		font-weight: 600;
		margin-bottom: 0.75rem;
		text-align: center;
	}

	.log-scroll {
		background: #232530;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-family: monospace;
		font-size: 0.875rem;
		max-height: 70vh;
		max-width: 100%;
		overflow: hidden;
	}

	.log-body {
		padding: 1.25rem;
		max-height: calc(40vh - 2.5rem);
		max-width: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.log-body :global(.log-scroll-area) {
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: 100%;
	}

	.log-line {
		color: white;
		margin-bottom: 0.5rem;
		word-break: break-word;
		overflow-wrap: break-word;
		white-space: pre-wrap;
	}

	.warning-box {
		background: #232530;
		border-radius: 0.5rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.warning-row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		color: white;
	}

	.warning-icon {
		color: #f59e0b;
		margin-top: 0.125rem;
		flex-shrink: 0;
	}

	.warning-text {
		font-size: 0.875rem;
	}
</style>
