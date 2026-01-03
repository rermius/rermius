/**
 * Sync Checker Composable
 *
 * Handles periodic checking for sync updates.
 * Polls every minute when sync is configured and validated.
 *
 * @example
 * // In a layout or root component
 * import { useSyncChecker } from '$lib/composables';
 *
 * // Start checking (call in onMount or $effect)
 * const { start, stop, checkNow } = useSyncChecker();
 * start();
 *
 * // Cleanup on unmount
 * onDestroy(() => stop());
 */

import { get } from 'svelte/store';
import { syncVersionStore, hasNewSyncVersion } from '$lib/stores/sync-version.store.js';
import { syncSettingsStore } from '$lib/stores/sync-settings.store.js';
import { performCheckForUpdates, performGetLatestVersion } from '$lib/services';

// Check interval: 1 minute
const CHECK_INTERVAL_MS = 60 * 1000;

// Singleton state for the checker
let intervalId = null;
let isRunning = false;

/**
 * Check for sync updates once
 * @returns {Promise<{hasUpdate: boolean, error?: string}>}
 */
async function checkForUpdates() {
	syncVersionStore.setChecking(true);

	try {
		const versionState = get(syncVersionStore);
		const result = await performCheckForUpdates(versionState.lastKnownVersion);
		if (result.error) {
			syncVersionStore.setCheckError(result.error);
			return { hasUpdate: false, error: result.error };
		}

		syncVersionStore.setRemoteVersion(result.latestVersion, result.latestTimestamp);

		return { hasUpdate: result.hasUpdate };
	} catch (error) {
		const errorMsg = error.message || 'Failed to check for updates';
		syncVersionStore.setCheckError(errorMsg);
		return { hasUpdate: false, error: errorMsg };
	}
}

/**
 * Initialize lastKnownVersion based on the provider's latest version.
 * Ensures we don't show a false "new version" badge on first load.
 */
async function initializeLastKnownVersion() {
	syncVersionStore.setChecking(true);

	try {
		const { version, timestamp, error } = await performGetLatestVersion();

		if (error) {
			syncVersionStore.setCheckError(error);
			return;
		}

		if (version) {
			// Align both last known and latest remote to the current version
			syncVersionStore.setLastKnownVersion(version);
			syncVersionStore.setRemoteVersion(version, timestamp);
		}
	} catch (error) {
		syncVersionStore.setCheckError(error.message || 'Failed to initialize version');
	} finally {
		syncVersionStore.setChecking(false);
	}
}

/**
 * Start periodic checking
 */
function startChecking() {
	if (isRunning) return;

	// Check immediately on start
	checkForUpdates();

	// Then check every interval
	intervalId = setInterval(() => {
		const settings = get(syncSettingsStore);
		const providerConfig = settings[settings.activeTab];

		// Only check if provider is validated
		if (providerConfig?.isValidated) {
			checkForUpdates();
		}
	}, CHECK_INTERVAL_MS);

	isRunning = true;
}

/**
 * Stop periodic checking
 */
function stopChecking() {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
	}
	isRunning = false;
}

/**
 * Composable for sync checking
 * @returns {Object} Sync checker controls
 */
export function useSyncChecker() {
	return {
		/**
		 * Start periodic checking
		 */
		start: startChecking,

		/**
		 * Stop periodic checking
		 */
		stop: stopChecking,

		/**
		 * Check for updates immediately
		 */
		checkNow: checkForUpdates,

		/**
		 * Whether the checker is running
		 */
		get isRunning() {
			return isRunning;
		},

		/**
		 * Get the hasNewSyncVersion store
		 */
		hasNewVersion: hasNewSyncVersion,

		/**
		 * Mark version as synced (after download)
		 * @param {string} version - The version that was synced
		 */
		markAsSynced(version) {
			syncVersionStore.setLastKnownVersion(version);
		}
	};
}

/**
 * Initialize sync checker on app start
 * Call this in the main layout component
 */
export function initSyncChecker() {
	const settings = get(syncSettingsStore);
	const providerConfig = settings[settings.activeTab];

	// Only start if provider is validated
	if (providerConfig?.isValidated) {
		// If user has synced before but lastKnownVersion is not set,
		// we need to initialize it on first check
		const versionState = get(syncVersionStore);
		const hasEverSynced = settings.lastSync?.lastUpload || settings.lastSync?.lastDownload;

		if (!versionState.lastKnownVersion && hasEverSynced) {
			// First check will initialize lastKnownVersion
			// This prevents false "new version" alerts on app start
			initializeLastKnownVersion();
		}

		startChecking();
	}

	// Return cleanup function
	return stopChecking;
}
