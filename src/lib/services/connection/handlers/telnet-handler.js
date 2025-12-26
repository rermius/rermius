import { BaseConnectionHandler } from './base.js';
import { connectTelnet } from '$lib/services/telnet-connection.js';
import { terminalCommands } from '$lib/services';

/**
 * Telnet Connection Handler
 * Handles Telnet terminal connections
 */
export class TelnetConnectionHandler extends BaseConnectionHandler {
	canHandle(connectionType) {
		return connectionType === 'telnet';
	}

	createTab(host, tabsStore) {
		// Reuse SSH tab creation - same terminal UI
		return tabsStore.addSSHTab({
			hostId: host.id,
			baseLabel: host.label
		});
	}

	async connect(host, onLog) {
		return await connectTelnet(host, onLog);
	}

	async close(sessionId) {
		return await terminalCommands.closeTerminal(sessionId);
	}
}
