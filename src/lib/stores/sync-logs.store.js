import { writable } from 'svelte/store';

/**
 * Sync Logs Store
 * Stores sync logs during the session (in memory, not persisted)
 */
function createSyncLogsStore() {
	const { subscribe, set, update } = writable([]);

	let logIdCounter = 0;

	return {
		subscribe,
		set,
		update,

		/**
		 * Add a log entry
		 * @param {string} message - Log message
		 * @param {'info' | 'success' | 'error' | 'warning' | 'separator'} type - Log type
		 * @param {'upload' | 'download' | null} logType - Log category (upload or download)
		 */
		addLog: (message, type = 'info', logType = null) => {
			logIdCounter += 1;
			update(logs => [
				...logs,
				{
					id: logIdCounter,
					timestamp: Date.now(),
					message,
					type,
					logType // 'upload', 'download', or null
				}
			]);
		},

		/**
		 * Clear all logs
		 */
		clear: () => {
			set([]);
			logIdCounter = 0;
		},

		/**
		 * Reset counter (for testing)
		 */
		resetCounter: () => {
			logIdCounter = 0;
		}
	};
}

export const syncLogsStore = createSyncLogsStore();
