import { BaseConnectionHandler } from './base.js';
import { connectSSH } from '$lib/services/ssh-connection';
import { terminalCommands } from '$lib/services';

/**
 * SSH Connection Handler
 * Handles SSH/SFTP terminal connections
 */
export class SSHConnectionHandler extends BaseConnectionHandler {
	canHandle(connectionType) {
		return ['ssh', 'sftp'].includes(connectionType);
	}

	createTab(host, tabsStore) {
		return tabsStore.addSSHTab({
			hostId: host.id,
			baseLabel: host.label
		});
	}

	async connect(host, onLog) {
		return await connectSSH(host, onLog);
	}

	async close(sessionId) {
		return await terminalCommands.closeTerminal(sessionId);
	}
}
