import { get } from 'svelte/store';
import { tabsStore } from '$lib/stores';
import { connectionFactory } from '$lib/services/connection';

/**
 * Handle connection to a host
 * Uses Strategy Pattern via ConnectionFactory to handle different connection types
 * @param {Object} host - The host to connect to
 * @returns {Promise<void>}
 */
export async function handleHostConnect(host) {
	const connectionType = host.connectionType || 'ssh';

	// Get appropriate handler from factory
	const handler = connectionFactory.getHandler(connectionType);

	// Create tab using handler
	const tabId = handler.createTab(host, tabsStore);

	const updateLogs = log => {
		const currentTabs = get(tabsStore).tabs;
		const currentTab = currentTabs.find(t => t.id === tabId);
		if (currentTab) {
			tabsStore.updateTabConnectionState(tabId, {
				connectionLogs: [...(currentTab.connectionLogs || []), log]
			});
		}
	};

	try {
		// Store host config in tab for potential reconnection
		tabsStore.setTabHostConfig(tabId, host);

		// Initialize reconnect state
		tabsStore.updateTabReconnectState(tabId, {
			autoReconnectRetryCount: 0,
			isReconnecting: false,
			reconnectCancelled: false
		});

		// Connect using handler
		const result = await handler.connect(host, updateLogs);

		// Success - update tab to CONNECTED state with animation flag
		tabsStore.updateTabConnectionState(tabId, {
			connectionState: 'CONNECTED',
			sessionId: result.sessionId,
			showProgressAnimation: true
		});

		// Reset reconnect state on successful connection
		tabsStore.resetTabReconnectState(tabId);

		// Wait 400ms for progress bar animation to complete
		setTimeout(() => {
			tabsStore.updateTabConnectionState(tabId, {
				showProgressAnimation: false
			});
		}, 400);
	} catch (error) {
		// Failed - update tab to FAILED state
		tabsStore.updateTabConnectionState(tabId, {
			connectionState: 'FAILED',
			connectionError: error.message,
			connectionLogs: error.logs || []
		});
	}
}
