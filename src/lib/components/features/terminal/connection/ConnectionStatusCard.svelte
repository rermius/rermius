<!--
@component ConnectionStatusCard
Displays SSH/SFTP/FTP connection status with visual progress indicator.

Uses Context API pattern to share state with child components (ConnectionProgressBar,
ConnectionLogViewer) without prop drilling.

@prop {Object} tab - Tab object with connection state and logs
@prop {Object} host - Host configuration object
@prop {Function} [onclose] - Callback when close button clicked
@prop {Function} [onretry] - Callback when retry button clicked
@prop {Function} [onedit] - Callback when edit host button clicked
-->
<script>
	import { Button } from '$lib/components/ui';
	import { getConnectionIcon } from '$lib/utils';
	import { X } from 'lucide-svelte';
	import { tabsStore } from '$lib/stores';
	import ConnectionProgressBar from './ConnectionProgressBar.svelte';
	import ConnectionLogViewer from './ConnectionLogViewer.svelte';
	import { createConnectionContext } from './connectionContext.svelte.js';

	const props = $props();

	// Create context for child components - using getter functions for reactivity
	const ctx = createConnectionContext(
		() => props.tab,
		() => props.host,
		{
			onclose: () => props.onclose?.(),
			onretry: () => props.onretry?.(),
			onedit: () => props.onedit?.()
		}
	);

	let showLogs = $state(false);

	// Get connection icon component
	const ConnectionIcon = $derived(getConnectionIcon(props.host?.connectionType || 'ssh'));

	function handleCancelReconnect() {
		tabsStore.cancelTabReconnect(props.tab.id);
	}

	function handleShowLogs() {
		showLogs = !showLogs;
	}

	function handleCopyLogs() {
		if (ctx.connectionLogs.length > 0) {
			const logsText = ctx.connectionLogs.join('\n');
			navigator.clipboard.writeText(logsText);
		}
	}
</script>

<div class="connection-layout">
	<div class="connection-content">
		<!-- Fixed Header Section -->
		<div class="header-section">
			<!-- Host Info -->
			<div class="host-info">
				<!-- Host Icon -->
				<div class="host-icon" style="background-color: {ctx.hostColor}">
					<ConnectionIcon size={17} />
				</div>

				<!-- Host Details -->
				<div class="host-details">
					<h3 class="host-label">{ctx.hostLabel}</h3>
					<p class="host-address">{ctx.hostAddress}</p>
				</div>
			</div>

			<!-- Action Button -->
			<button
				onclick={() => (ctx.connectionState === 'FAILED' ? handleCopyLogs() : handleShowLogs())}
				class="action-button"
			>
				{ctx.connectionState === 'FAILED' ? 'Copy logs' : 'Show logs'}
			</button>
		</div>

		<!-- Reconnecting Status -->
		{#if ctx.isReconnecting && ctx.reconnectMessage}
			<div class="reconnecting-status">
				<div class="reconnecting-content">
					<div class="reconnecting-spinner"></div>
					<span class="reconnecting-text">{ctx.reconnectMessage}</span>
				</div>
				<button
					onclick={handleCancelReconnect}
					class="cancel-reconnect-button"
					title="Cancel reconnect"
				>
					<X size={14} />
				</button>
			</div>
		{/if}

		<!-- Child components now use context, only pass local UI state -->
		<ConnectionProgressBar />

		<ConnectionLogViewer {showLogs} />

		<!-- Footer Actions -->
		<div class="footer-actions">
			<!-- Left Buttons -->
			<div class="button-group">
				<Button variant="secondary" onclick={ctx.actions.close}>Close</Button>
				{#if ctx.connectionState === 'FAILED'}
					<Button variant="secondary" onclick={ctx.actions.editHost}>Edit host</Button>
				{/if}
			</div>

			<!-- Right Buttons -->
			<div class="button-group">
				{#if ctx.connectionState === 'FAILED'}
					<Button variant="success" onclick={ctx.actions.retry}>Start over</Button>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* Main Layout Container */
	.connection-layout {
		position: fixed;
		top: 10%;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 380px;
		height: auto;
		z-index: 1000;
	}

	.connection-content {
		padding: 1.4rem;
	}

	/* Header Section */
	.header-section {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2.1rem;
	}

	.host-info {
		display: flex;
		align-items: center;
		gap: 0.84rem;
	}

	.host-icon {
		width: 2.52rem;
		height: 2.52rem;
		border-radius: 0.56rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		flex-shrink: 0;
	}

	.host-details {
		display: flex;
		flex-direction: column;
		gap: 0.14rem;
	}

	.host-label {
		color: white;
		font-weight: bold;
		font-size: 0.98rem;
		margin: 0;
	}

	.host-address {
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.77rem;
		margin: 0;
	}

	.action-button {
		background-color: #2f3241;
		color: white;
		padding: 0.56rem 1.12rem;
		border-radius: 0.42rem;
		font-size: 0.77rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.action-button:hover {
		background-color: #3a3d4e;
	}

	/* Footer Actions */
	.footer-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1.4rem;
	}

	.button-group {
		display: flex;
		gap: 0.7rem;
	}

	/* Reconnecting Status */
	.reconnecting-status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background-color: #2f3241;
		border-radius: 0.42rem;
		padding: 0.7rem 1.12rem;
		margin-bottom: 1.05rem;
	}

	.reconnecting-content {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.reconnecting-spinner {
		width: 0.84rem;
		height: 0.84rem;
		border: 2px solid rgba(59, 130, 246, 0.3);
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.reconnecting-text {
		color: white;
		font-size: 0.77rem;
		font-weight: 500;
	}

	.cancel-reconnect-button {
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		cursor: pointer;
		padding: 0.28rem;
		border-radius: 0.28rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.cancel-reconnect-button:hover {
		background-color: rgba(255, 255, 255, 0.1);
		color: white;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
