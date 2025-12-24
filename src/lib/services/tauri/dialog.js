/**
 * Tauri dialog utilities for file and folder selection
 */
import { open, save } from '@tauri-apps/plugin-dialog';

export const tauriDialog = {
	/**
	 * Open file selection dialog
	 * @param {Object} options - Dialog options
	 * @param {boolean} options.multiple - Allow multiple file selection
	 * @param {Array<Object>} options.filters - File type filters
	 * @param {string} options.defaultPath - Default directory path
	 * @returns {Promise<string|string[]|null>} Selected file path(s) or null
	 */
	async openFile(options = {}) {
		try {
			const result = await open({
				multiple: false,
				directory: false,
				...options
			});
			return result;
		} catch (error) {
			console.error('Failed to open file dialog:', error);
			throw new Error(`Failed to open file: ${error}`);
		}
	},

	/**
	 * Open directory selection dialog
	 * @param {Object} options - Dialog options
	 * @param {string} options.defaultPath - Default directory path
	 * @returns {Promise<string|null>} Selected directory path or null
	 */
	async openDirectory(options = {}) {
		try {
			const result = await open({
				directory: true,
				...options
			});
			return result;
		} catch (error) {
			console.error('Failed to open directory dialog:', error);
			throw new Error(`Failed to open directory: ${error}`);
		}
	},

	/**
	 * Open save file dialog
	 * @param {Object} options - Dialog options
	 * @param {Array<Object>} options.filters - File type filters
	 * @param {string} options.defaultPath - Default save path
	 * @returns {Promise<string|null>} Selected save path or null
	 */
	async saveFile(options = {}) {
		try {
			const result = await save(options);
			return result;
		} catch (error) {
			console.error('Failed to open save dialog:', error);
			throw new Error(`Failed to save file: ${error}`);
		}
	}
};
