import { BaseConnectionHandler } from './base.js';
import { connectFileTransfer } from '../file.js';
import { closeFileSession } from '../../files/browser.js';

/**
 * File Transfer Connection Handler
 * Handles FTP/FTPS file browser connections
 */
export class FileTransferConnectionHandler extends BaseConnectionHandler {
	canHandle(connectionType) {
		return ['ftp', 'ftps'].includes(connectionType);
	}

	createTab(host, tabsStore) {
		return tabsStore.addFileBrowserTab({
			hostId: host.id,
			baseLabel: host.label,
			connectionType: host.connectionType
		});
	}

	async connect(host, onLog) {
		return await connectFileTransfer(host, onLog);
	}

	async close(sessionId) {
		return await closeFileSession(sessionId);
	}
}
