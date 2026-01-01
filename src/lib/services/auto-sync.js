/**
 * Auto Sync Service
 * Automatically uploads data to GitHub Gist when stores change
 */

import { get } from 'svelte/store';
import { syncSettingsStore } from '../stores/sync-settings.store.js';
import { hostsStore } from './hosts.js';
import { snippetsStore } from './snippets.js';
import { keychainStore } from './keychain.js';
import { saveSyncSettings } from './sync-settings.js';
import { performUpload } from './sync-checker';
import { syncVersionStore } from '$lib/stores/sync-version.store.js';

const DEBOUNCE_MS = 30000; // 30s

let debounceTimer = null;
let isInitialized = false;
let isSyncing = false;

// Loading state tracking
let isLoadingData = false;
let initialLoadComplete = false;

// Store unsubscribe functions
let unsubscribeHosts = null;
let unsubscribeSnippets = null;
let unsubscribeKeychain = null;

/**
 * Mark start of data loading (prevents sync during file load)
 */
export function markLoadingStart() {
	isLoadingData = true;
}

/**
 * Mark end of data loading (enables subscriptions)
 */
export function markLoadingComplete() {
	isLoadingData = false;
	initialLoadComplete = true;
}

/**
 * Remove auto-generated metadata fields
 */
function cleanMetadata(data) {
	const cleaned = JSON.parse(JSON.stringify(data));

	// Remove metadata.lastModified
	if (cleaned.metadata) {
		delete cleaned.metadata.lastModified;
	}

	// Exclude snippet click counts
	if (cleaned.snippets) {
		cleaned.snippets = cleaned.snippets.map(s => {
			const { clickCount, ...rest } = s;
			return rest;
		});
	}

	return cleaned;
}

/**
 * Deep equality check excluding metadata.lastModified
 */
function areStoreStatesEqual(prev, current) {
	if (!prev || !current) return false;

	const prevCleaned = cleanMetadata(prev);
	const currentCleaned = cleanMetadata(current);

	return JSON.stringify(prevCleaned) === JSON.stringify(currentCleaned);
}

/**
 * Create subscription handler for a store
 */
function createStoreSubscription(storeName, store) {
	let previousState = null;

	return store.subscribe(currentState => {
		// Skip if not initialized
		if (!isInitialized) {
			previousState = currentState;
			return;
		}

		// Skip during data loading
		if (isLoadingData) {
			previousState = currentState;
			return;
		}

		// Skip if initial load not complete
		if (!initialLoadComplete) {
			previousState = currentState;
			return;
		}

		// Skip if no previous state
		if (!previousState) {
			previousState = currentState;
			return;
		}

		// Check for real changes (excluding metadata.lastModified)
		const hasRealChange = !areStoreStatesEqual(previousState, currentState);

		if (hasRealChange) {
			console.log(`[AutoSync] Change detected in ${storeName}Store`);
			triggerSync();
			previousState = currentState;
		}
	});
}

/**
 * Debounced sync trigger
 */
function triggerSync() {
	if (debounceTimer) {
		clearTimeout(debounceTimer);
	}

	debounceTimer = setTimeout(() => {
		performSync();
	}, DEBOUNCE_MS);
}

/**
 * Perform the actual sync (upload to GitHub)
 */
async function performSync() {
	const settings = get(syncSettingsStore);

	// Skip if auto sync disabled or not validated
	if (!settings.autoSync.enabled || !settings.github.isValidated) {
		return;
	}

	// Skip if already syncing
	if (isSyncing) return;

	isSyncing = true;

	try {
		const hostsData = get(hostsStore);
		const snippetsData = get(snippetsStore);
		const keychainData = get(keychainStore);

		// Upload via factory (driver hidden)
		const result = await performUpload({
			hostsData,
			syncOptions: settings.syncOptions,
			snippetsData,
			keychainData,
			source: 'rerminus-autosync'
		});

		if (result.success) {
			console.log('[AutoSync] Sync successful');
			if (result.providerId && !settings.github.gist) {
				syncSettingsStore.updateGithub({ gist: result.providerId });
				await saveSyncSettings(get(syncSettingsStore));
			}
			syncSettingsStore.updateLastSync({ lastUpload: Date.now() });
			await saveSyncSettings(get(syncSettingsStore));
			if (result.latestVersion) {
				syncVersionStore.setLastKnownVersion(result.latestVersion);
				if (result.latestTimestamp) {
					syncVersionStore.setRemoteVersion(result.latestVersion, result.latestTimestamp);
				}
			}
		} else {
			console.warn('[AutoSync] Upload failed:', result.message);
		}
	} catch (error) {
		console.error('[AutoSync] Error:', error);
	} finally {
		isSyncing = false;
	}
}

/**
 * Initialize auto sync with store subscriptions
 */
export function initAutoSync() {
	if (isInitialized) {
		return;
	}

	// Subscribe to all stores
	unsubscribeHosts = createStoreSubscription('hosts', hostsStore);
	unsubscribeSnippets = createStoreSubscription('snippets', snippetsStore);
	unsubscribeKeychain = createStoreSubscription('keychain', keychainStore);

	isInitialized = true;
	console.log('[AutoSync] Initialized');
}

/**
 * Stop auto sync and cleanup subscriptions
 */
export function stopAutoSync() {
	if (debounceTimer) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}

	// Cleanup subscriptions
	if (unsubscribeHosts) unsubscribeHosts();
	if (unsubscribeSnippets) unsubscribeSnippets();
	if (unsubscribeKeychain) unsubscribeKeychain();

	unsubscribeHosts = null;
	unsubscribeSnippets = null;
	unsubscribeKeychain = null;

	isInitialized = false;
	initialLoadComplete = false;
}

/**
 * Force immediate sync (skip debounce)
 */
export async function forceSync() {
	if (debounceTimer) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}
	await performSync();
}
