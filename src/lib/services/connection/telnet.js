/**
 * Telnet Connection Service
 * Handles Telnet connection process with progress logging
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Connect to Telnet host with progress logging
 * @param {Object} host - Host configuration
 * @param {string} host.hostname - Hostname or IP
 * @param {number} host.port - Telnet port (default 23)
 * @param {string} [host.username] - Username for auto-login
 * @param {string} [host.password] - Password for auto-login
 * @param {Function} onLog - Callback for each log entry
 * @returns {Promise<{sessionId: string, logs: string[]}>}
 */
export async function connectTelnet(host, onLog) {
	const logs = [];

	const addLog = (message, detail = '') => {
		const logEntry = detail ? `${message} ${detail}` : message;
		logs.push(logEntry);
		if (onLog) onLog(logEntry);
	};

	try {
		addLog('⚙️ Starting Telnet connection to:', `"${host.hostname}:${host.port || 23}"`);

		// Note: Telnet transmits in plain text
		if (host.username) {
			addLog('🔑 Auto-login enabled for user:', host.username);
		}

		const sessionId = await invoke('create_telnet_session', {
			hostname: host.hostname,
			port: host.port || 23,
			username: host.username || null,
			password: host.password || null,
			cols: 80,
			rows: 24
		});

		addLog('✅ Connected successfully');

		return { sessionId, logs };
	} catch (error) {
		const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
		addLog('❌ Connection failed:', errorMessage);
		throw {
			message: errorMessage,
			logs
		};
	}
}

/**
 * Retry Telnet connection
 * @param {Object} host - Host configuration
 * @param {Function} onLog - Callback for each log entry
 * @returns {Promise<{sessionId: string, logs: string[]}>}
 */
export async function retryTelnetConnection(host, onLog) {
	return connectTelnet(host, onLog);
}
