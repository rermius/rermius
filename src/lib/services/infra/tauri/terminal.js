import { invoke } from '@tauri-apps/api/core';

/**
 * Terminal command wrappers (Facade Pattern)
 * Provides a clean interface to Tauri terminal commands
 */
export const terminalCommands = {
	/**
	 * Create a new terminal session
	 * @param {Object} config - Terminal configuration
	 * @param {string} [config.shell] - Shell path (optional, uses system default)
	 * @param {number} [config.cols=80] - Terminal columns
	 * @param {number} [config.rows=24] - Terminal rows
	 * @returns {Promise<string>} Session ID
	 */
	async createTerminal({ shell = null, cols = 80, rows = 24 } = {}) {
		try {
			const sessionId = await invoke('create_terminal', { shell, cols, rows });
			return sessionId;
		} catch (error) {
			console.error('Failed to create terminal:', error);
			throw new Error(`Failed to create terminal: ${error}`);
		}
	},

	/**
	 * Write data to terminal
	 * @param {string} sessionId - Terminal session ID
	 * @param {string} data - Data to write
	 * @returns {Promise<void>}
	 */
	async writeTerminal(sessionId, data) {
		try {
			await invoke('write_terminal', { sessionId, data });
		} catch (error) {
			console.error('Failed to write to terminal:', error);
			throw new Error(`Failed to write to terminal: ${error}`);
		}
	},

	/**
	 * Resize terminal
	 * @param {string} sessionId - Terminal session ID
	 * @param {number} cols - New column count
	 * @param {number} rows - New row count
	 * @returns {Promise<void>}
	 */
	async resizeTerminal(sessionId, cols, rows) {
		try {
			await invoke('resize_terminal', { sessionId, cols, rows });
		} catch (error) {
			console.error('Failed to resize terminal:', error);
			throw new Error(`Failed to resize terminal: ${error}`);
		}
	},

	/**
	 * Close terminal session
	 * @param {string} sessionId - Terminal session ID
	 * @returns {Promise<void>}
	 */
	async closeTerminal(sessionId) {
		try {
			await invoke('close_terminal', { sessionId });
		} catch (error) {
			console.error('Failed to close terminal:', error);
			throw new Error(`Failed to close terminal: ${error}`);
		}
	},

	/**
	 * Start streaming output for a session (call after listener is ready)
	 * @param {string} sessionId - Terminal session ID
	 * @returns {Promise<void>}
	 */
	async startStreaming(sessionId) {
		try {
			await invoke('start_terminal_streaming', { sessionId });
		} catch (error) {
			// Ignore errors for local terminals (they auto-stream)
			console.debug('Start streaming:', error);
		}
	},

	/**
	 * Ping terminal session (keepalive check)
	 * @param {string} sessionId - Terminal session ID
	 * @returns {Promise<boolean>} True if session is alive
	 */
	async ping(sessionId) {
		try {
			const result = await invoke('ping_terminal', { sessionId });
			return result === true || result === 'true'; // Handle string or boolean
		} catch (error) {
			console.debug('Terminal ping failed:', sessionId, error);
			throw new Error(`Terminal ping failed: ${error}`);
		}
	},

	/**
	 * Execute a command on a terminal session and return output
	 * Only works for SSH sessions
	 * @param {string} sessionId - Terminal session ID
	 * @param {string} command - Command to execute
	 * @returns {Promise<string>} Command output
	 */
	async executeCommand(sessionId, command) {
		try {
			return await invoke('execute_terminal_command', { sessionId, command });
		} catch (error) {
			console.error('Failed to execute command:', error);
			throw new Error(`Failed to execute command: ${error}`);
		}
	},

	/**
	 * Fetch command history from SSH session
	 * @param {string} sessionId - Terminal session ID
	 * @param {number} [limit=100] - Number of history entries to fetch
	 * @returns {Promise<string[]>} Array of command history
	 */
	async fetchHistory(sessionId, limit = 100) {
		try {
			return await invoke('fetch_command_history', { sessionId, limit });
		} catch (error) {
			console.error('Failed to fetch command history:', error);
			throw new Error(`Failed to fetch command history: ${error}`);
		}
	},

	/**
	 * Fetch command history from local shell (system history files)
	 * @param {Object} [options]
	 * @param {string|null} [options.shell=null] - Optional shell path/name hint (e.g. '/bin/bash')
	 * @param {number} [options.limit=100] - Number of history entries to fetch
	 * @returns {Promise<string[]>} Array of command history
	 */
	async fetchLocalHistory({ shell = null, limit = 100 } = {}) {
		try {
			return await invoke('fetch_local_shell_history', { shell, limit });
		} catch (error) {
			console.error('Failed to fetch local shell history:', error);
			throw new Error(`Failed to fetch local shell history: ${error}`);
		}
	}
};
