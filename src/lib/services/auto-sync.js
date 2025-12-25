/**
 * Auto Sync Service
 * Automatically uploads data to GitHub Gist when stores change
 */

import { get } from 'svelte/store';
import { syncSettingsStore } from '../stores/sync-settings.store.js';
import { hostsStore } from './hosts.js';
import { snippetsStore } from './snippets.js';
import { saveSyncSettings } from './sync-settings.js';
import { performUpload } from './sync-checker';
import { syncVersionStore } from '$lib/stores/sync-version.store.js';

const DEBOUNCE_MS = 60000; // 1 minute

let debounceTimer = null;
let isInitialized = false;
let isSyncing = false;

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

	// Skip if already syncing or missing credentials
	if (isSyncing) return;

	isSyncing = true;

	try {
		const hostsData = get(hostsStore);
		const snippetsData = get(snippetsStore);

		// Upload via factory (driver hidden)
		const result = await performUpload({
			hostsData,
			syncOptions: settings.syncOptions,
			snippetsData,
			source: 'rermius-autosync'
		});

		if (result.success) {
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
			console.warn('[AutoSync] Upload successful');
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
 * Trigger sync from save action
 * @param {string} source - Source of the save action (host, group, key)
 */
export function triggerSyncOnSave(source) {
	const settings = get(syncSettingsStore);
	if (settings.autoSync.enabled && settings.github.isValidated) {
		console.warn(`[AutoSync] Triggered by: ${source}`);
		triggerSync();
	} else {
		console.warn(`[AutoSync] Skipped (disabled or not validated) - source: ${source}`);
	}
}

/**
 * Initialize auto sync
 */
export function initAutoSync() {
	if (isInitialized) return;
	isInitialized = true;
}

/**
 * Stop auto sync
 */
export function stopAutoSync() {
	if (debounceTimer) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}
	isInitialized = false;
	console.warn('[AutoSync] Stopped');
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
