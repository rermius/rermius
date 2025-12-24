import { SSHConnectionHandler } from './handlers/ssh-handler.js';
import { FileTransferConnectionHandler } from './handlers/file-transfer-handler.js';

/**
 * Connection Factory
 * Creates appropriate connection handler based on connection type
 */
class ConnectionFactory {
	constructor() {
		this.handlers = [new SSHConnectionHandler(), new FileTransferConnectionHandler()];
	}

	/**
	 * Get handler for connection type
	 * @param {string} connectionType - Connection type
	 * @returns {BaseConnectionHandler}
	 * @throws {Error} If no handler found
	 */
	getHandler(connectionType) {
		const handler = this.handlers.find(h => h.canHandle(connectionType));

		if (!handler) {
			throw new Error(`No handler found for connection type: ${connectionType}`);
		}

		return handler;
	}

	/**
	 * Register a new handler
	 * @param {BaseConnectionHandler} handler - Handler to register
	 */
	register(handler) {
		this.handlers.push(handler);
	}
}

// Singleton instance
export const connectionFactory = new ConnectionFactory();
