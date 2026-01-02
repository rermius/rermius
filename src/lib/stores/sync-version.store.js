/**
 * Sync Version Store
 *
 * Tracks remote sync version and update status.
 * Used to show red dot indicator when new version is available.
 */

import { writable, derived, get } from 'svelte/store';
import { syncSettingsStore } from './sync-settings.store.js';
import { saveSyncSettings } from '$lib/services/sync-settings.js';

function serializeState(state) {
	return {
		...state,
		latestRemoteTimestamp: state.latestRemoteTimestamp
			? state.latestRemoteTimestamp.toISOString()
			: null,
		lastCheckTime: state.lastCheckTime ? state.lastCheckTime.toISOString() : null
	};
}

function rehydrateState(raw) {
	if (!raw) return null;
	return {
		...raw,
		latestRemoteTimestamp: raw.latestRemoteTimestamp ? new Date(raw.latestRemoteTimestamp) : null,
		lastCheckTime: raw.lastCheckTime ? new Date(raw.lastCheckTime) : null
	};
}

/**
 * Store structure:
 * {
 *   lastKnownVersion: string|null,     // Version after last upload/download
 *   latestRemoteVersion: string|null,  // Latest version from remote check
 *   latestRemoteTimestamp: Date|null,  // Timestamp of latest remote version
 *   lastCheckTime: Date|null,          // When we last checked for updates
 *   isChecking: boolean,               // Currently checking for updates
 *   checkError: string|null,           // Error from last check
 * }
 */
function createSyncVersionStore() {
	const defaultState = {
		lastKnownVersion: null,
		latestRemoteVersion: null,
		latestRemoteTimestamp: null,
		lastCheckTime: null,
		isChecking: false,
		checkError: null
	};

	const settingsSnapshot = get(syncSettingsStore);
	const persistedState = rehydrateState(settingsSnapshot?.syncVersion);
	const initialState = persistedState ? { ...defaultState, ...persistedState } : defaultState;

	const store = writable(initialState);
	const { subscribe, set, update } = store;

	let isPersisting = false;
	let isHydrating = false; // Flag to prevent auto-save during external loads
	let currentState = initialState;

	// Keep local cache of current state
	subscribe(state => {
		currentState = state;
	});

	// Persist into syncSettings file (only after settings are loaded)
	subscribe(async state => {
		try {
			const settings = get(syncSettingsStore);
			if (!settings.__loaded) return;
			// Don't auto-save during hydration (workspace switch, external load)
			if (isHydrating) return;
			isPersisting = true;
			syncSettingsStore.update(s => ({
				...s,
				syncVersion: serializeState(state)
			}));
			await saveSyncSettings(get(syncSettingsStore));
		} catch (e) {
			console.error('Failed to persist sync version to settings file', e);
		} finally {
			isPersisting = false;
		}
	});

	// Hydrate when syncSettingsStore changes externally (workspace switch, load)
	syncSettingsStore.subscribe(settings => {
		if (isPersisting) return;
		const incoming = rehydrateState(settings?.syncVersion);
		if (!incoming) return;

		const same =
			incoming.lastKnownVersion === currentState.lastKnownVersion &&
			incoming.latestRemoteVersion === currentState.latestRemoteVersion &&
			(incoming.latestRemoteTimestamp?.getTime() || null) ===
				(currentState.latestRemoteTimestamp?.getTime() || null) &&
			(incoming.lastCheckTime?.getTime() || null) ===
				(currentState.lastCheckTime?.getTime() || null) &&
			incoming.isChecking === currentState.isChecking &&
			incoming.checkError === currentState.checkError;

		if (!same) {
			// Set hydrating flag to prevent auto-save during external load
			isHydrating = true;
			set({ ...defaultState, ...incoming });
			// Reset flag after hydration completes
			setTimeout(() => {
				isHydrating = false;
			}, 100);
		}
	});

	return {
		subscribe,

		/**
		 * Set the last known version (after upload or download)
		 * This clears the "new version" indicator
		 */
		setLastKnownVersion(version) {
			update(state => ({
				...state,
				lastKnownVersion: version,
				// If we just synced to this version, no update available
				latestRemoteVersion: version,
				checkError: null
			}));
		},

		/**
		 * Update with remote check result
		 */
		setRemoteVersion(version, timestamp) {
			update(state => ({
				...state,
				latestRemoteVersion: version,
				latestRemoteTimestamp: timestamp,
				lastCheckTime: new Date(),
				isChecking: false,
				checkError: null
			}));
		},

		/**
		 * Set checking state
		 */
		setChecking(isChecking) {
			update(state => ({
				...state,
				isChecking
			}));
		},

		/**
		 * Set check error
		 */
		setCheckError(error) {
			update(state => ({
				...state,
				checkError: error,
				isChecking: false,
				lastCheckTime: new Date()
			}));
		},

		/**
		 * Clear the new version indicator (mark as seen)
		 */
		clearNewVersionIndicator() {
			update(state => ({
				...state,
				lastKnownVersion: state.latestRemoteVersion
			}));
		},

		/**
		 * Reset store to initial state
		 */
		reset() {
			set(defaultState);
		}
	};
}

export const syncVersionStore = createSyncVersionStore();

/**
 * Derived store: Whether a new version is available
 */
export const hasNewSyncVersion = derived(syncVersionStore, $store => {
	// No update if no remote version or no last known version
	if (!$store.latestRemoteVersion || !$store.lastKnownVersion) {
		return false;
	}

	// Compare versions
	return $store.latestRemoteVersion !== $store.lastKnownVersion;
});

/**
 * Derived store: Human-readable time since last check
 */
export const lastCheckTimeAgo = derived(syncVersionStore, $store => {
	if (!$store.lastCheckTime) return null;

	const now = new Date();
	const diff = now - $store.lastCheckTime;
	const minutes = Math.floor(diff / 60000);

	if (minutes < 1) return 'just now';
	if (minutes === 1) return '1 minute ago';
	if (minutes < 60) return `${minutes} minutes ago`;

	const hours = Math.floor(minutes / 60);
	if (hours === 1) return '1 hour ago';
	return `${hours} hours ago`;
});
