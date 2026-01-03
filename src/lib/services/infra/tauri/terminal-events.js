import { listen } from '@tauri-apps/api/event';

/**
 * Terminal event listeners (Observer Pattern)
 * Provides event subscription for terminal output, exit, and errors
 */
export const terminalEvents = {
	/**
	 * Listen for terminal output
	 * @param {string} sessionId - Terminal session ID
	 * @param {Function} callback - Callback receiving output data
	 * @returns {Promise<Function>} Unlisten function
	 */
	async onTerminalOutput(sessionId, callback) {
		try {
			return await listen(`terminal-output:${sessionId}`, event => {
				callback(event.payload);
			});
		} catch (error) {
			console.error('Failed to listen for terminal output:', error);
			throw error;
		}
	},

	/**
	 * Listen for terminal exit
	 * @param {string} sessionId - Terminal session ID
	 * @param {Function} callback - Callback receiving exit event {exit_code: number, reason?: string}
	 * @returns {Promise<Function>} Unlisten function
	 */
	async onTerminalExit(sessionId, callback) {
		try {
			return await listen(`terminal-exit:${sessionId}`, event => {
				// Handle both old format (just number) and new format (object)
				const payload = event.payload;
				if (typeof payload === 'number') {
					// Legacy format: just exit code
					callback({ exit_code: payload, reason: null });
				} else {
					// New format: object with exit_code and reason
					callback(payload);
				}
			});
		} catch (error) {
			console.error('Failed to listen for terminal exit:', error);
			throw error;
		}
	},

	/**
	 * Listen for terminal errors
	 * @param {string} sessionId - Terminal session ID
	 * @param {Function} callback - Callback receiving error message
	 * @returns {Promise<Function>} Unlisten function
	 */
	async onTerminalError(sessionId, callback) {
		try {
			return await listen(`terminal-error:${sessionId}`, event => {
				callback(event.payload);
			});
		} catch (error) {
			console.error('Failed to listen for terminal errors:', error);
			throw error;
		}
	}
};
