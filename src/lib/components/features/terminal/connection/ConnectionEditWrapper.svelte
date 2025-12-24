<!--
@component ConnectionEditWrapper
Wrapper view for remote SSH connections with edit panel support.
Displays connection status and allows in-place host configuration editing.

@example
```svelte
<ConnectionEditWrapper
  {tab}
  {host}
  onRetry={handleRetry}
  onEdit={handleEdit}
  onClose={handleClose}
/>
```

@prop {Object} tab - Tab object with connection state
@prop {Object} host - Host configuration object
@prop {Function} onRetry - Callback for retry connection
@prop {Function} onEdit - Callback for edit host
@prop {Function} onClose - Callback for close tab

Features:
- SSH connection status display
- Inline host editing with panel overlay
- Connection retry with fresh logs
- Progress animation on successful connection
-->
<script>
	import { ContentWithPanel } from '$lib/components/layout';
	import { HostPanel } from '$lib/components/features/hosts';
	import ConnectionStatusCard from './ConnectionStatusCard.svelte';
	import { tabsStore } from '$lib/stores';
	import { connectSSH } from '$lib/services';

	const { tab, host, onRetry, onEdit, onClose } = $props();

	const showEditPanel = $derived(tab.showEditPanel || false);

	function handleClosePanel() {
		tabsStore.updateTabConnectionState(tab.id, {
			showEditPanel: false
		});
	}

	async function handleHostSave(savedHost) {
		// Close panel
		handleClosePanel();

		// Reset tab to CONNECTING state with CLEARED logs
		tabsStore.updateTabConnectionState(tab.id, {
			connectionState: 'CONNECTING',
			connectionLogs: [],
			connectionError: null,
			showProgressAnimation: false
		});

		// Retry connection on the SAME tab (don't create new tab)
		// Track new logs in fresh array
		const newLogs = [];

		try {
			const result = await connectSSH(savedHost, log => {
				// Collect logs in fresh array (not appending to old logs)
				newLogs.push(log);
				tabsStore.updateTabConnectionState(tab.id, {
					connectionLogs: [...newLogs]
				});
			});

			// Success - update tab to CONNECTED state
			tabsStore.updateTabConnectionState(tab.id, {
				connectionState: 'CONNECTED',
				sessionId: result.sessionId,
				showProgressAnimation: true
			});

			// Wait for progress bar animation (longer to visualize success)
			setTimeout(() => {
				tabsStore.updateTabConnectionState(tab.id, {
					showProgressAnimation: false
				});
			}, 900);
		} catch (error) {
			// Failed - update tab to FAILED state with fresh logs
			tabsStore.updateTabConnectionState(tab.id, {
				connectionState: 'FAILED',
				connectionError: error.message,
				connectionLogs: error.logs || []
			});
		}
	}
</script>

{#if showEditPanel}
	<!-- Show edit panel with connection view in background -->
	<div class="h-full flex">
		<!-- Left: Connection view (static) -->
		<div class="flex-1">
			<ConnectionStatusCard {tab} {host} onretry={onRetry} onedit={onEdit} onclose={onClose} />
		</div>

		<!-- Right: Edit panel (overlay) -->
		<ContentWithPanel showPanel={true} showMenu={false} onclose={handleClosePanel}>
			{#snippet content()}
				<div class="hidden"></div>
			{/snippet}
			{#snippet panel()}
				<HostPanel editingHost={host} autoConnect={false} onsave={handleHostSave} />
			{/snippet}
		</ContentWithPanel>
	</div>
{:else}
	<!-- Normal connection view -->
	<ConnectionStatusCard {tab} {host} onretry={onRetry} onedit={onEdit} onclose={onClose} />
{/if}
