import { writable } from 'svelte/store';

/**
 * File clipboard state management
 * Stores files for copy/cut/paste operations across file manager panels
 *
 * @typedef {Object} ClipboardState
 * @property {Array<FileClipboardItem>} files - Files in clipboard
 * @property {'copy' | 'cut' | null} operation - Operation type
 * @property {string|null} sourceSessionId - Session ID for remote files (null for local)
 * @property {'local' | 'remote' | null} sourceType - Source panel type
 * @property {number|null} timestamp - When clipboard was populated
 */

/**
 * @typedef {Object} FileClipboardItem
 * @property {string} path - Full file path
 * @property {string} name - File name
 * @property {boolean} isDirectory - Is directory
 */

function createFileClipboardStore() {
	const { subscribe, set, update } = writable({
		files: [],
		operation: null,
		sourceSessionId: null,
		sourceType: null,
		timestamp: null
	});

	return {
		subscribe,

		/**
		 * Copy files to clipboard
		 * @param {Array<FileClipboardItem>} files - Files to copy
		 * @param {'local' | 'remote'} sourceType - Source panel type
		 * @param {string|null} sessionId - Session ID (for remote files)
		 */
		copy: (files, sourceType, sessionId = null) => {
			set({
				files,
				operation: 'copy',
				sourceSessionId: sessionId,
				sourceType,
				timestamp: Date.now()
			});
		},

		/**
		 * Cut files to clipboard
		 * @param {Array<FileClipboardItem>} files - Files to cut
		 * @param {'local' | 'remote'} sourceType - Source panel type
		 * @param {string|null} sessionId - Session ID (for remote files)
		 */
		cut: (files, sourceType, sessionId = null) => {
			set({
				files,
				operation: 'cut',
				sourceSessionId: sessionId,
				sourceType,
				timestamp: Date.now()
			});
		},

		/**
		 * Clear clipboard
		 */
		clear: () => {
			set({
				files: [],
				operation: null,
				sourceSessionId: null,
				sourceType: null,
				timestamp: null
			});
		},

		/**
		 * Check if clipboard has files
		 * @returns {boolean}
		 */
		hasFiles: () => {
			let hasFiles = false;
			const unsubscribe = subscribe(state => {
				hasFiles = state.files.length > 0;
			});
			unsubscribe();
			return hasFiles;
		}
	};
}

export const fileClipboardStore = createFileClipboardStore();
