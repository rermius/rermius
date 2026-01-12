<script>
	import { tabsStore } from '$lib/stores';
	import {
		hostsStore,
		connectionFactory,
		closeFileSession,
		connectFileTransfer,
		appSettingsStore
	} from '$lib/services';
	import { terminalStore } from '$lib/stores/terminal.store';
	import { getThemeById } from '$lib/constants/terminal-themes';
	import { defaultFontFamily } from '$lib/constants/terminal-fonts';
	import Header from './Header.svelte';
	import { ToastContainer, ScrollArea } from '$lib/components/ui';
	import StatusBar from '$lib/components/ui/StatusBar.svelte';
	import UpdateNotification from '$lib/components/features/update/UpdateNotification.svelte';
	import { RemoteTerminalContainer } from '$lib/components/features/terminal/containers';
	import FileBrowserTabContainer from './FileBrowserTabContainer.svelte';
	import { updateStore } from '$lib/stores';
	import { onMount, onDestroy } from 'svelte';
	import { useActiveTabTheme } from '$lib/composables/useActiveTabTheme.svelte.js';

	const tabs = $derived($tabsStore.tabs);
	const activeTabId = $derived($tabsStore.activeTabId);
	const activeTab = $derived(tabs.find(t => t.id === activeTabId));
	const hosts = $derived($hostsStore.hosts || []);

	const { children } = $props();

	// Track file-manager session creation to avoid duplicate calls
	const fileSessionLoading = $state(new Set());

	// Initialize active tab theme watcher and apply theme immediately
	// The subscription runs IMMEDIATELY with current value, so theme is synced on first load
	const tabThemeWatcher = useActiveTabTheme();
	tabThemeWatcher.init();

	// Track previous local terminal settings to detect changes
	let prevLocalSettings = $state(null);

	// Watch for local terminal settings changes and sync all local terminals
	$effect(() => {
		const settings = $appSettingsStore.localTerminal;

		// Skip if settings not loaded yet
		if (!settings) {
			return;
		}

		// Skip first run (initialization)
		if (!prevLocalSettings) {
			prevLocalSettings = { ...settings };
			return;
		}

		// Check if settings actually changed
		const hasChanged =
			prevLocalSettings.themeId !== settings.themeId ||
			prevLocalSettings.fontSize !== settings.fontSize ||
			prevLocalSettings.fontFamily !== settings.fontFamily;

		if (!hasChanged) {
			return;
		}

		// Update all local terminal sessions
		const allSessions = $terminalStore.sessions;

		allSessions.forEach(session => {
			// Only update local terminals (type === 'local')
			if (session.type === 'local' && session.xterm) {
				const terminal = session.xterm;

				// Apply theme
				if (settings.themeId) {
					const theme = getThemeById(settings.themeId);
					if (theme) {
						terminal.options.theme = theme.colors;
					}
				}

				// Apply font family
				if (settings.fontFamily && settings.fontFamily !== 'default') {
					terminal.options.fontFamily = settings.fontFamily;
				} else if (settings.fontFamily === 'default') {
					terminal.options.fontFamily = defaultFontFamily;
				}

				// Apply font size
				if (settings.fontSize) {
					terminal.options.fontSize = settings.fontSize;
				}

				// Force visual refresh - use fitAddon.fit() which triggers full repaint
				if (session.fitAddon) {
					setTimeout(() => {
						session.fitAddon.fit();
					}, 50);
				}
			}
		});

		// Update tracked settings
		prevLocalSettings = { ...settings };

		// Force app theme update if a local terminal is active
		const activeTab = tabs.find(t => t.id === activeTabId);
		if (activeTab && activeTab.type === 'terminal' && !activeTab.hostId) {
			setTimeout(() => {
				tabThemeWatcher.forceUpdate();
			}, 150);
		}
	});

	// Get host data for a tab
	function getHostForTab(tab) {
		if (tab.hostId) {
			return hosts.find(h => h.id === tab.hostId);
		}
		return null;
	}

	// Get connection handler for a tab
	function getHandlerForTab(tab) {
		const host = getHostForTab(tab);
		if (!host) return null;

		const connectionType = host.connectionType || tab.connectionType || 'ssh';
		return connectionFactory.getHandler(connectionType);
	}

	async function ensureFileSession(tab, host) {
		if (!tab?.showFileManager || tab.fileSessionId || !host) return;
		if (fileSessionLoading.has(tab.id)) return;

		fileSessionLoading.add(tab.id);
		try {
			// Reuse host config but force connectionType to sftp for file manager
			const fileHost = { ...host, connectionType: 'sftp' };
			const result = await connectFileTransfer(fileHost);
			tabsStore.updateTabConnectionState(tab.id, {
				fileSessionId: result.sessionId
			});
		} catch (error) {
			console.error('Failed to create file manager session:', error);
			tabsStore.updateTabConnectionState(tab.id, {
				showFileManager: false
			});
			console.warn('[MainLayout] Disabling split view due to error', {
				tabId: tab.id,
				error: error?.message
			});
		} finally {
			fileSessionLoading.delete(tab.id);
		}
	}

	// Kick off file-manager session creation when split view is enabled
	$effect(() => {
		tabs
			.filter(t => t.type === 'terminal' && t.showFileManager)
			.forEach(tab => {
				const host = getHostForTab(tab);
				ensureFileSession(tab, host);
			});
	});

	// Close file session when split view is disabled
	$effect(() => {
		tabs
			.filter(t => t.type === 'terminal' && !t.showFileManager && t.fileSessionId)
			.forEach(async tab => {
				const fileSessionId = tab.fileSessionId;
				try {
					await closeFileSession(fileSessionId);
					tabsStore.updateTabConnectionState(tab.id, {
						fileSessionId: null
					});
				} catch (error) {
					console.error('[MainLayout] Error closing file session:', {
						tabId: tab.id,
						fileSessionId,
						error
					});
				}
			});
	});

	// Handle retry connection (works for all connection types)
	async function handleRetryConnection(tab) {
		const host = getHostForTab(tab);
		if (!host) return;

		const handler = getHandlerForTab(tab);
		if (!handler) return;

		// Reset to CONNECTING state with CLEARED logs
		tabsStore.updateTabConnectionState(tab.id, {
			connectionState: 'CONNECTING',
			connectionLogs: [],
			connectionError: null,
			showProgressAnimation: false
		});

		// Start fresh connection with new logs
		const newLogs = [];

		try {
			const result = await handler.retry(host, log => {
				// Collect logs in fresh array (not appending to old logs)
				newLogs.push(log);
				tabsStore.updateTabConnectionState(tab.id, {
					connectionLogs: [...newLogs]
				});
			});

			// Success - update tab to CONNECTED state with animation flag
			tabsStore.updateTabConnectionState(tab.id, {
				connectionState: 'CONNECTED',
				sessionId: result.sessionId,
				showProgressAnimation: true
			});

			// Wait longer for progress bar animation to be visible
			setTimeout(() => {
				tabsStore.updateTabConnectionState(tab.id, {
					showProgressAnimation: false
				});
			}, 900);
		} catch (error) {
			// Failed with fresh logs
			tabsStore.updateTabConnectionState(tab.id, {
				connectionState: 'FAILED',
				connectionError: error.message,
				connectionLogs: error.logs || []
			});
		}
	}

	// Handle edit host from connection view
	function handleEditHost(tab) {
		// Show edit panel in the terminal tab
		tabsStore.updateTabConnectionState(tab.id, {
			showEditPanel: true
		});
	}

	// Handle close connection view (works for all connection types)
	async function handleCloseConnection(tab) {
		// Cancel auto-reconnect if in progress
		if (tab?.isReconnecting) {
			tabsStore.cancelTabReconnect(tab.id);
		}

		// Close session using handler
		if (tab?.sessionId) {
			const handler = getHandlerForTab(tab);
			if (handler) {
				try {
					await handler.close(tab.sessionId);
				} catch (error) {
					// Log error but continue with tab removal
					console.error('Error closing session:', error);
				}
			}
		}

		// Remove tab after session is closed
		tabsStore.removeTab(tab.id);
	}

	onMount(() => {
		// Check for app updates
		updateStore.checkForUpdates();
	});

	onDestroy(() => {
		// Cleanup theme watcher subscription
		tabThemeWatcher.destroy();
	});
</script>

<div
	class="flex justify-center items-center h-screen bg-[var(--color-bg-primary)] text-text-primary"
>
	<div class="flex flex-col w-full h-full overflow-hidden rounded-lg">
		<!-- Header -->
		<Header />

		<!-- Body -->
		<main class="flex-1 overflow-hidden relative bg-[var(--color-bg-primary)]">
			<!-- Home page content -->
			<div
				class="absolute inset-0"
				style:visibility={activeTab?.type === 'home' ? 'visible' : 'hidden'}
				style="z-index: {activeTab?.type === 'home' ? 'var(--z-tab-active)' : '-1'};"
				style:pointer-events={activeTab?.type === 'home' ? 'auto' : 'none'}
			>
				<ScrollArea class="h-full">
					{@render children()}
				</ScrollArea>
			</div>

			<!-- Terminal sessions - render all but show only active -->
			{#each tabs.filter(t => t.type === 'terminal') as terminalTab (terminalTab.id)}
				<div
					class="absolute inset-0"
					style:visibility={terminalTab.id === activeTabId ? 'visible' : 'hidden'}
					style="z-index: {terminalTab.id === activeTabId ? 'var(--z-tab-active)' : '-1'};"
					style:pointer-events={terminalTab.id === activeTabId ? 'auto' : 'none'}
				>
					<RemoteTerminalContainer
						tab={terminalTab}
						{activeTabId}
						host={getHostForTab(terminalTab)}
						onRetry={() => handleRetryConnection(terminalTab)}
						onEdit={() => handleEditHost(terminalTab)}
						onClose={() => handleCloseConnection(terminalTab)}
					/>
				</div>
			{/each}

			<!-- File Browser sessions -->
			{#each tabs.filter(t => t.type === 'file-browser') as fbTab (fbTab.id)}
				<div
					class="absolute inset-0"
					style:visibility={fbTab.id === activeTabId ? 'visible' : 'hidden'}
					style="z-index: {fbTab.id === activeTabId ? 'var(--z-tab-active)' : '-1'};"
					style:pointer-events={fbTab.id === activeTabId ? 'auto' : 'none'}
				>
					<FileBrowserTabContainer
						tab={fbTab}
						{activeTabId}
						host={getHostForTab(fbTab)}
						onRetry={() => handleRetryConnection(fbTab)}
						onEdit={() => handleEditHost(fbTab)}
						onClose={() => handleCloseConnection(fbTab)}
					/>
				</div>
			{/each}
		</main>
	</div>

	<!-- Toast notifications -->
	<ToastContainer position="top-right" />
	<UpdateNotification />

	<!-- Status Bar -->
	<StatusBar />
</div>
