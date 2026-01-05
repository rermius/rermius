/**
 * Terminal Exit Handler Strategy Pattern
 * Separates exit handling logic by session type for better maintainability
 */

import { get } from 'svelte/store';
import { tabsStore, terminalStore } from '$lib/stores';
import { getAutoReconnectSettings, getHostById, attemptReconnect } from '$lib/services';
import { useToast } from '$lib/composables';

const toast = useToast();

/**
 * Create exit handler for local terminal sessions
 * Simple notification without auto-reconnect
 *
 * @param {string} sessionId - Terminal session ID
 * @returns {Function} Exit event handler function
 */
function createLocalExitHandler(sessionId) {
	return async exitEvent => {
		const exitCode = typeof exitEvent === 'number' ? exitEvent : exitEvent?.exit_code || 0;

		console.log(`[LocalTerminal] Session ${sessionId} exited with code ${exitCode}`);

		// Show user notification
		toast.show({
			message: `Terminal exited with code ${exitCode}`,
			type: 'info'
		});

		// Update terminal store (cleanup will be handled by composable)
		// No auto-reconnect for local terminals
	};
}

/**
 * Create exit handler for SSH terminal sessions
 * Complex logic with auto-reconnect support
 *
 * @param {string} sessionId - Terminal session ID
 * @returns {Function} Exit event handler function
 */
function createSshExitHandler(sessionId) {
	return async exitEvent => {
		const exitCode = typeof exitEvent === 'number' ? exitEvent : exitEvent?.exit_code;
		const reason = typeof exitEvent === 'object' ? exitEvent.reason : null;

		console.log(`[SSHTerminal] Session ${sessionId} exited:`, { exitCode, reason });

		// Find tab associated with this session
		const tabs = get(tabsStore);
		const tab = tabs.tabs.find(t => t.sessionId === sessionId);

		if (!tab) {
			console.warn(`[SSHTerminal] Tab not found for sessionId: ${sessionId}`);
			return;
		}

		// Check if this was a user-initiated disconnect
		const isUserClosed = reason === 'user-closed' || tab.reconnectCancelled;

		if (isUserClosed) {
			// User explicitly closed the connection - no auto-reconnect
			tabsStore.updateTabConnectionState(tab.id, {
				connectionState: 'FAILED',
				connectionError: 'Connection closed by user'
			});
			return;
		}

		// Check if tab still exists and hasn't been cancelled
		const currentTabs = get(tabsStore);
		const currentTab = currentTabs.tabs.find(t => t.id === tab.id);

		if (!currentTab) {
			console.log(`[SSHTerminal] Tab ${tab.id} no longer exists, skipping reconnect`);
			return;
		}

		if (currentTab.reconnectCancelled) {
			console.log(`[SSHTerminal] Reconnect cancelled for tab ${tab.id}`);
			return;
		}

		// Get global auto-reconnect settings
		const settings = getAutoReconnectSettings();

		if (settings.enabled) {
			// Trigger auto-reconnect flow
			console.log(`[SSHTerminal] Starting auto-reconnect for tab ${tab.id}`);

			try {
				await attemptReconnect(tab.id);
			} catch (error) {
				console.error('[SSHTerminal] Failed to trigger auto-reconnect:', error);

				// Update tab state to FAILED
				tabsStore.updateTabConnectionState(tab.id, {
					connectionState: 'FAILED',
					connectionError: `Connection lost: ${error.message}`
				});
			}
		} else {
			// Auto-reconnect disabled - mark as failed
			console.log(`[SSHTerminal] Auto-reconnect disabled for tab ${tab.id}`);

			tabsStore.updateTabConnectionState(tab.id, {
				connectionState: 'FAILED',
				connectionError: 'Connection lost'
			});

			toast.show({
				message: `SSH connection lost: ${reason || 'Unknown reason'}`,
				type: 'error'
			});
		}
	};
}

/**
 * Create exit handler for Telnet terminal sessions
 * Simple notification without auto-reconnect (similar to local)
 *
 * @param {string} sessionId - Terminal session ID
 * @returns {Function} Exit event handler function
 */
function createTelnetExitHandler(sessionId) {
	return async exitEvent => {
		const exitCode = typeof exitEvent === 'number' ? exitEvent : exitEvent?.exit_code || 0;
		const reason = typeof exitEvent === 'object' ? exitEvent.reason : null;

		console.log(`[TelnetTerminal] Session ${sessionId} exited:`, { exitCode, reason });

		// Show user notification
		toast.show({
			message: reason ? `Telnet session closed: ${reason}` : 'Telnet session closed',
			type: 'info'
		});

		// Update terminal store (cleanup will be handled by composable)
		// No auto-reconnect for telnet terminals (for now)
	};
}

/**
 * Factory function to create appropriate exit handler based on session type
 * Strategy Pattern implementation
 *
 * @param {string} sessionType - 'local' | 'ssh' | 'telnet'
 * @param {string} sessionId - Terminal session ID
 * @returns {Function} Exit event handler function
 * @throws {Error} If session type is unknown
 */
export function createExitHandler(sessionType, sessionId) {
	switch (sessionType) {
		case 'local':
			return createLocalExitHandler(sessionId);

		case 'ssh':
			return createSshExitHandler(sessionId);

		case 'telnet':
			return createTelnetExitHandler(sessionId);

		default:
			throw new Error(`Unknown session type: ${sessionType}`);
	}
}

/**
 * Setup terminal exit event listener with appropriate handler
 * Convenience function that combines listener setup with handler creation
 *
 * @param {string} sessionId - Terminal session ID
 * @param {string} sessionType - 'local' | 'ssh' | 'telnet'
 * @param {Object} terminalEvents - Terminal events service
 * @returns {Promise<Function>} Unlisten function
 */
export async function setupExitListener(sessionId, sessionType, terminalEvents) {
	const exitHandler = createExitHandler(sessionType, sessionId);
	return await terminalEvents.onTerminalExit(sessionId, exitHandler);
}
