<script>
	import { ConnectionEditWrapper } from '$lib/components/features/terminal';
	import { FileBrowserDualPane } from '$lib/components/features/file-browser';

	const { tab, activeTabId, host = null, onRetry, onEdit, onClose } = $props();

	// Backend will auto-detect home directory for FTP/SFTP
	// Only use user-provided homeDirectory if explicitly set and non-empty
	const homeDir = $derived(
		host?.homeDirectory && host.homeDirectory.trim() ? host.homeDirectory : '/'
	);
</script>

{#if tab.connectionState === 'CONNECTING' || tab.connectionState === 'FAILED'}
	<ConnectionEditWrapper {tab} {host} {onRetry} {onEdit} {onClose} />
{:else if tab.connectionState === 'CONNECTED' && tab.sessionId}
	<div class="h-full">
		<FileBrowserDualPane
			sessionId={tab.sessionId}
			remoteType={tab.connectionType}
			hostId={tab.hostId}
			remoteInitialPath={homeDir}
		/>
	</div>
{/if}
