import { listen } from '@tauri-apps/api/event';

/**
 * Tauri event listeners for handling backend events
 * Each method returns an unlisten function to clean up the listener
 */
export const tauriEvents = {
	/**
	 * Listen for SSH connection events
	 * @param {Function} callback - Function to call when SSH connects
	 * @returns {Promise<Function>} Unlisten function
	 */
	async onSSHConnect(callback) {
		try {
			return await listen('ssh-connected', event => {
				callback(event.payload);
			});
		} catch (error) {
			console.error('Failed to listen for SSH connect:', error);
			throw error;
		}
	},

	/**
	 * Listen for SSH disconnection events
	 * @param {Function} callback - Function to call when SSH disconnects
	 * @returns {Promise<Function>} Unlisten function
	 */
	async onSSHDisconnect(callback) {
		try {
			return await listen('ssh-disconnected', event => {
				callback(event.payload);
			});
		} catch (error) {
			console.error('Failed to listen for SSH disconnect:', error);
			throw error;
		}
	},

	/**
	 * Listen for error events
	 * @param {Function} callback - Function to call on errors
	 * @returns {Promise<Function>} Unlisten function
	 */
	async onError(callback) {
		try {
			return await listen('error', event => {
				callback(event.payload);
			});
		} catch (error) {
			console.error('Failed to listen for errors:', error);
			throw error;
		}
	},

	/**
	 * Listen for custom events
	 * @param {string} eventName - Name of the event to listen for
	 * @param {Function} callback - Function to call when event fires
	 * @returns {Promise<Function>} Unlisten function
	 */
	async on(eventName, callback) {
		try {
			return await listen(eventName, event => {
				callback(event.payload);
			});
		} catch (error) {
			console.error(`Failed to listen for ${eventName}:`, error);
			throw error;
		}
	}
};
