import { writable } from 'svelte/store';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Update Store
 *
 * Manages application update lifecycle.
 * Statuses: 'idle', 'checking', 'available', 'downloading', 'ready', 'error'
 */
function createUpdateStore() {
	const { subscribe, set, update } = writable({
		status: 'idle', // idle, checking, available, downloading, ready, error
		manifest: null, // { version, body, date }
		error: null,
		progress: 0,
		updateObj: null // The update object from Tauri
	});

	return {
		subscribe,

		/**
		 * Check for updates
		 */
		async checkForUpdates(silent = true) {
			if (!silent) {
				update(s => ({ ...s, status: 'checking', error: null }));
			}

			try {
				const updateObj = await check();

				if (updateObj) {
					set({
						status: 'available',
						manifest: {
							version: updateObj.version,
							body: updateObj.body,
							date: updateObj.date
						},
						error: null,
						progress: 0,
						updateObj
					});
					return true;
				} else {
					if (!silent) {
						set({ status: 'idle', manifest: null, error: null, progress: 0, updateObj: null });
					}
					return false;
				}
			} catch (err) {
				console.error('[UpdateStore] Failed to check for updates:', err);
				set({
					status: 'error',
					manifest: null,
					error: err.message || String(err),
					progress: 0,
					updateObj: null
				});
				return false;
			}
		},

		/**
		 * Download and install the update
		 * @param {boolean} autoRestart - Whether to automatically relaunch after download
		 */
		async downloadAndInstall(autoRestart = false) {
			let currentUpdateObj = null;

			update(s => {
				if (s.status !== 'available' || !s.updateObj) return s;
				currentUpdateObj = s.updateObj;
				return { ...s, status: 'downloading', progress: 0 };
			});

			if (!currentUpdateObj) return;

			try {
				await currentUpdateObj.downloadAndInstall(progress => {
					if (progress.event === 'Started') {
						update(inner => ({ ...inner, progress: 0 }));
					} else if (progress.event === 'Finished') {
						update(inner => ({ ...inner, status: 'ready', progress: 100 }));
					}
				});

				update(inner => ({ ...inner, status: 'ready' }));

				if (autoRestart) {
					await relaunch();
				}
			} catch (err) {
				console.error('[UpdateStore] Failed to download/install update:', err);
				update(inner => ({ ...inner, status: 'error', error: err.message || String(err) }));
			}
		},

		/**
		 * Relaunch the app to apply the update
		 */
		async applyAndRestart() {
			try {
				await relaunch();
			} catch (err) {
				console.error('[UpdateStore] Failed to relaunch app:', err);
			}
		},

		/**
		 * Dismiss the notification
		 */
		dismiss() {
			set({ status: 'idle', manifest: null, error: null, progress: 0, updateObj: null });
		},

		/**
		 * Mock update (for development/demo)
		 */
		mockUpdate() {
			set({
				status: 'available',
				manifest: {
					version: '9.34.8',
					body: 'New features and bug fixes.',
					date: 'Dec 25'
				},
				error: null,
				progress: 0,
				updateObj: {
					downloadAndInstall: async cb => {
						cb({ event: 'Started' });
						await new Promise(r => setTimeout(r, 1000));
						cb({ event: 'Finished' });
					}
				}
			});
		}
	};
}

export const updateStore = createUpdateStore();
