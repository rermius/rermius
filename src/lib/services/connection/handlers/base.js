/**
 * Base Connection Handler
 * Abstract base class for connection handlers
 */
export class BaseConnectionHandler {
	/**
	 * Check if this handler can handle the connection type
	 * @param {string} connectionType - Connection type
	 * @returns {boolean}
	 */
	canHandle(connectionType) {
		throw new Error('canHandle must be implemented');
	}

	/**
	 * Create a new tab for this connection type
	 * @param {Object} host - Host configuration
	 * @param {Object} tabsStore - Tabs store
	 * @returns {string} Tab ID
	 */
	createTab(host, tabsStore) {
		throw new Error('createTab must be implemented');
	}

	/**
	 * Connect to the host
	 * @param {Object} host - Host configuration
	 * @param {Function} onLog - Log callback
	 * @returns {Promise<{sessionId: string, logs: string[]}>}
	 */
	async connect(host, onLog) {
		throw new Error('connect must be implemented');
	}

	/**
	 * Retry connection
	 * @param {Object} host - Host configuration
	 * @param {Function} onLog - Log callback
	 * @returns {Promise<{sessionId: string, logs: string[]}>}
	 */
	async retry(host, onLog) {
		return this.connect(host, onLog);
	}

	/**
	 * Close the session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<void>}
	 */
	async close(sessionId) {
		throw new Error('close must be implemented');
	}
}
