/**
 * Auto-Reconnect Service (Refactored)
 * Handles automatic reconnection logic for remote connections
 *
 * Improvements:
 * - Loop-based retry instead of recursion (prevents stack overflow)
 * - Exponential backoff (prevents server hammering)
 * - Better race condition handling (validates tab at each step)
 * - Network state awareness (pauses when offline)
 * - Total timeout limit (prevents infinite waiting)
 * - Atomic state updates (reduces race conditions)
 */
import { get } from 'svelte/store';
import { tabsStore } from '$lib/stores';
import { getAutoReconnectSettings } from '../data/app-settings.js';
import { connectionFactory } from './index.js';
import { networkStateMonitor } from '../infra/network-state.js';

// Track active reconnect operations to prevent duplicates
const activeReconnects = new Set();

/**
 * Calculate exponential backoff delay
 * @param {number} attemptNumber - Current attempt number (1-based)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay cap
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attemptNumber, baseDelay = 5000, maxDelay = 60000) {
	// Exponential: delay * 2^(attempt-1)
	// Attempt 1: 5s, Attempt 2: 10s, Attempt 3: 20s, Attempt 4: 40s
	const delay = baseDelay * Math.pow(2, attemptNumber - 1);
	return Math.min(delay, maxDelay);
}

/**
 * Get current tab state safely
 * @param {string} tabId - Tab ID
 * @returns {Object|null} Tab object or null if not found
 */
function getTabSafely(tabId) {
	const tabs = get(tabsStore);
	return tabs.tabs.find(t => t.id === tabId) || null;
}

/**
 * Wait for delay with cancellation support
 * @param {number} delay - Delay in milliseconds
 * @param {string} tabId - Tab ID to check for cancellation
 * @returns {Promise<boolean>} True if completed, false if cancelled
 */
async function waitWithCancellation(delay, tabId) {
	const startTime = Date.now();

	// Poll every 500ms to check for cancellation
	while (Date.now() - startTime < delay) {
		const tab = getTabSafely(tabId);
		if (!tab || tab.reconnectCancelled) {
			return false; // Cancelled
		}

		// Wait 500ms or remaining time, whichever is less
		const remaining = delay - (Date.now() - startTime);
		const waitTime = Math.min(500, remaining);
		if (waitTime > 0) {
			await new Promise(resolve => setTimeout(resolve, waitTime));
		}
	}

	return true; // Completed without cancellation
}

/**
 * Attempt to reconnect a tab using loop-based retry with exponential backoff
 * @param {string} tabId - Tab ID to reconnect
 * @returns {Promise<boolean>} True if reconnect was successful, false otherwise
 */
export async function attemptReconnect(tabId) {
	// Prevent duplicate reconnect attempts for same tab
	if (activeReconnects.has(tabId)) {
		console.warn('[auto-reconnect] Already reconnecting tab:', tabId);
		return false;
	}

	activeReconnects.add(tabId);

	try {
		return await attemptReconnectInternal(tabId);
	} finally {
		activeReconnects.delete(tabId);
	}
}

/**
 * Internal reconnect logic (wrapped to ensure cleanup)
 */
async function attemptReconnectInternal(tabId) {
	// Initial validation
	const tab = getTabSafely(tabId);
	if (!tab) {
		console.warn('[auto-reconnect] Tab not found:', tabId);
		return false;
	}

	if (tab.reconnectCancelled) {
		console.log('[auto-reconnect] Reconnect cancelled by user for tab:', tabId);
		return false;
	}

	// Get global auto-reconnect settings
	const settings = getAutoReconnectSettings();

	if (!settings.enabled) {
		console.log('[auto-reconnect] Auto-reconnect is disabled');
		return false;
	}

	// Get host config from tab
	const hostConfig = tab.hostConfig;
	if (!hostConfig) {
		console.warn('[auto-reconnect] No host config found for tab:', tabId);
		return false;
	}

	// Get connection handler
	const connectionType = hostConfig.connectionType || 'ssh';
	const handler = connectionFactory.getHandler(connectionType);
	if (!handler) {
		console.error('[auto-reconnect] No handler for connection type:', connectionType);
		return false;
	}

	// Initialize retry state
	const startTime = Date.now();
	const maxTotalTime = settings.maxTotalTime || 300000; // 5 minutes default
	let attemptNumber = (tab.autoReconnectRetryCount || 0) + 1;

	console.log(
		`[auto-reconnect] Starting reconnect loop for tab: ${tabId}, max retries: ${settings.maxRetries}`
	);

	// LOOP-BASED RETRY (instead of recursion)
	while (attemptNumber <= settings.maxRetries) {
		// Check total time limit
		const elapsedTime = Date.now() - startTime;
		if (elapsedTime > maxTotalTime) {
			console.log('[auto-reconnect] Total timeout exceeded:', elapsedTime, 'ms');
			tabsStore.updateTabConnectionState(tabId, {
				connectionState: 'FAILED',
				connectionError: `Connection failed: timeout after ${Math.floor(elapsedTime / 1000)}s`
			});
			return false;
		}

		// Validate tab still exists and not cancelled
		const currentTab = getTabSafely(tabId);
		if (!currentTab) {
			console.log('[auto-reconnect] Tab no longer exists:', tabId);
			return false;
		}

		if (currentTab.reconnectCancelled) {
			console.log('[auto-reconnect] Reconnect cancelled by user');
			tabsStore.updateTabReconnectState(tabId, {
				isReconnecting: false
			});
			return false;
		}

		// Check network state before attempting
		if (!networkStateMonitor.isOnline()) {
			console.log('[auto-reconnect] Network offline, waiting...');

			// Wait for network to come back online (with timeout)
			const networkRestored = await networkStateMonitor.waitForOnline(30000);
			if (!networkRestored) {
				console.log('[auto-reconnect] Network still offline after 30s');
				// Continue anyway, will fail and retry
			}
		}

		// Update tab state for this attempt
		tabsStore.updateTabReconnectState(tabId, {
			autoReconnectRetryCount: attemptNumber,
			isReconnecting: true
		});

		console.log(`[auto-reconnect] Attempt ${attemptNumber}/${settings.maxRetries} for tab:`, tabId);

		// Calculate delay for this attempt (exponential backoff)
		const backoffDelay = calculateBackoffDelay(attemptNumber, settings.delay);

		// Wait before attempting (skip for first attempt)
		if (attemptNumber > 1) {
			console.log(`[auto-reconnect] Waiting ${backoffDelay}ms before retry...`);

			const waitCompleted = await waitWithCancellation(backoffDelay, tabId);
			if (!waitCompleted) {
				console.log('[auto-reconnect] Cancelled during backoff wait');
				tabsStore.updateTabReconnectState(tabId, {
					isReconnecting: false
				});
				return false;
			}
		}

		// Update tab to CONNECTING state
		tabsStore.updateTabConnectionState(tabId, {
			connectionState: 'CONNECTING',
			connectionError: null,
			connectionLogs: [
				`Reconnecting... (attempt ${attemptNumber}/${settings.maxRetries})`,
				`Backoff delay: ${backoffDelay}ms`
			]
		});

		// Update logs callback
		const updateLogs = log => {
			const currentTab = getTabSafely(tabId);
			if (currentTab) {
				tabsStore.updateTabConnectionState(tabId, {
					connectionLogs: [...(currentTab.connectionLogs || []), log]
				});
			}
		};

		try {
			// Attempt connection
			const result = await handler.connect(hostConfig, updateLogs);

			// SUCCESS - update tab to CONNECTED state
			console.log('[auto-reconnect] Reconnect successful for tab:', tabId);

			tabsStore.updateTabConnectionState(tabId, {
				connectionState: 'CONNECTED',
				sessionId: result.sessionId,
				fileSessionId: result.fileSessionId, // For file browser support
				showProgressAnimation: true
			});

			// Reset reconnect state on successful connection
			tabsStore.resetTabReconnectState(tabId);

			// Wait for progress bar animation
			setTimeout(() => {
				const tab = getTabSafely(tabId);
				if (tab) {
					tabsStore.updateTabConnectionState(tabId, {
						showProgressAnimation: false
					});
				}
			}, 400);

			return true; // SUCCESS - exit loop
		} catch (error) {
			// FAILED - log and continue to next attempt
			console.log(`[auto-reconnect] Attempt ${attemptNumber} failed:`, error.message);

			// Validate tab still exists before updating
			const currentTab = getTabSafely(tabId);
			if (!currentTab) {
				console.log('[auto-reconnect] Tab deleted during connection attempt');
				return false;
			}

			// Update tab with failure info
			tabsStore.updateTabConnectionState(tabId, {
				connectionState: 'FAILED',
				connectionError: error.message,
				connectionLogs: [
					...(currentTab.connectionLogs || []),
					`Attempt ${attemptNumber} failed: ${error.message}`
				]
			});

			tabsStore.updateTabReconnectState(tabId, {
				isReconnecting: false
			});

			// Check if we should continue to next attempt
			if (attemptNumber >= settings.maxRetries) {
				console.log('[auto-reconnect] Max retries exceeded');
				tabsStore.updateTabConnectionState(tabId, {
					connectionState: 'FAILED',
					connectionError: `Connection failed after ${settings.maxRetries} attempts`
				});
				return false;
			}

			// Continue to next iteration
			attemptNumber++;
		}
	}

	// Exhausted all retries
	return false;
}

/**
 * Cancel reconnect for a specific tab
 * @param {string} tabId - Tab ID
 */
export function cancelReconnect(tabId) {
	tabsStore.cancelTabReconnect(tabId);
	activeReconnects.delete(tabId);
	console.log('[auto-reconnect] Cancelled reconnect for tab:', tabId);
}

/**
 * Check if tab is currently reconnecting
 * @param {string} tabId - Tab ID
 * @returns {boolean} True if reconnecting
 */
export function isReconnecting(tabId) {
	return activeReconnects.has(tabId);
}
