/**
 * File Connection Service
 * Handles FTP/SFTP file transfer connections
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { parseChain } from '$lib/utils/host-chaining';
import { getKey } from './keychain';
import {
	writeTempKeyFile,
	prepareHopConfig,
	resolveChain,
	cleanupTempKeys
} from './ssh-connection';

/**
 * Connect to FTP/SFTP host for file transfer
 * Supports host chaining (ProxyJump) through intermediate jump hosts for SFTP
 * @param {Object} host - Host configuration
 * @param {string} host.connectionType - 'sftp' | 'ftp' | 'ftps'
 * @param {string} host.hostname - Hostname or IP
 * @param {number} host.port - Port
 * @param {string} host.username - Username
 * @param {string} [host.authMethod] - Auth method ('key' | 'password')
 * @param {string} [host.keyId] - SSH key ID (for SFTP with key auth)
 * @param {string} [host.password] - Password
 * @param {string} [host.proxyJump] - JSON array of jump host IDs (SFTP only)
 * @param {Function} onLog - Callback for each log entry
 * @returns {Promise<{sessionId: string, logs: string[]}>}
 */
export async function connectFileTransfer(host, onLog) {
	const logs = [];
	let tempKeyPaths = [];

	const addLog = (message, detail = '') => {
		const logEntry = detail ? `${message} ${detail}` : message;
		logs.push(logEntry);
		if (onLog) onLog(logEntry);
	};

	const connectionType = host.connectionType || 'sftp';
	const typeLabel = connectionType.toUpperCase();

	try {
		addLog(`⚙️ Starting ${typeLabel} connection to:`, `${host.hostname}:${host.port}`);

		// Check if SFTP with chain connection
		const chainIds = parseChain(host.proxyJump);
		const hasChain = connectionType === 'sftp' && chainIds.length > 0;

		if (hasChain) {
			// ===== CHAINED CONNECTION (ProxyJump) =====
			addLog(`⚙️ Preparing ${chainIds.length + 1}-hop connection chain...`);

			// Resolve chain to full configs
			const resolved = await resolveChain(host);
			tempKeyPaths = resolved.tempKeyPaths;
			const chain = resolved.chain;

			// Log the chain
			chain.forEach((hop, i) => {
				const isTarget = i === chain.length - 1;
				const label = isTarget ? 'Target' : `Jump ${i + 1}`;
				addLog(`  ${label}:`, `${hop.username}@${hop.hostname}:${hop.port}`);
			});

			addLog('⚙️ Establishing chained SFTP connection...');

			// Listen for chain progress events
			let unlisten = null;
			try {
				unlisten = await listen('ssh-chain-progress', event => {
					const { hop_index, total_hops, hostname, status, message } = event.payload;
					const hopNum = hop_index + 1;
					const statusIcon = status === 'connected' ? '✅' : status === 'failed' ? '❌' : '⚙️';
					addLog(`  [${hopNum}/${total_hops}] ${statusIcon}`, message);
				});
			} catch {
				// Event listener setup failed, continue without real-time updates
			}

			let sessionId;
			try {
				// Get target config (last in chain)
				const targetConfig = chain[chain.length - 1];

				// Prepare config with chain
				// jumps contains all hops except target, target info is in main config fields
				const config = {
					connectionType: connectionType,
					hostname: targetConfig.hostname,
					port: targetConfig.port,
					username: targetConfig.username,
					password: targetConfig.password || null,
					keyPath: targetConfig.key_path || null,
					jumps: chain.slice(0, -1) // All except the last (target)
				};

				sessionId = await invoke('create_file_session', { config });

				addLog('✅ Connected successfully through chain');
			} catch (invokeError) {
				addLog('❌ Chain connection failed:', invokeError.toString());
				throw invokeError;
			} finally {
				// Clean up event listener
				if (unlisten) unlisten();
			}

			cleanupTempKeys(tempKeyPaths);

			return { sessionId, logs };
		} else {
			// ===== DIRECT CONNECTION (no chain) =====
			// Prepare config
			const config = {
				connectionType: connectionType,
				hostname: host.hostname,
				port: host.port,
				username: host.username,
				password: host.password || null,
				keyPath: null,
				jumps: []
			};

			// Handle SFTP key authentication
			if (connectionType === 'sftp' && host.authMethod === 'key' && host.keyId) {
				addLog('⚙️ Loading SSH key...');
				const key = getKey(host.keyId);
				if (!key) {
					throw new Error('SSH key not found in keychain');
				}
				config.keyPath = await writeTempKeyFile(key.privateKey);
				tempKeyPaths.push(config.keyPath);
				addLog('⚙️ SSH key loaded');
			}

			addLog(`⚙️ Authenticating as:`, host.username);

			// Create file session
			const sessionId = await invoke('create_file_session', { config });

			addLog(`✅ ${typeLabel} connected successfully`);

			cleanupTempKeys(tempKeyPaths);

			return { sessionId, logs };
		}
	} catch (error) {
		addLog(`❌ ${typeLabel} connection failed:`, error.toString());
		cleanupTempKeys(tempKeyPaths);
		throw error;
	}
}

/**
 * Check if connection type is file transfer (not terminal)
 * @param {string} connectionType
 * @returns {boolean}
 */
export function isFileTransferType(connectionType) {
	return ['ftp', 'ftps', 'sftp'].includes(connectionType);
}

/**
 * Check if connection type requires terminal
 * @param {string} connectionType
 * @returns {boolean}
 */
export function isTerminalType(connectionType) {
	return ['ssh', 'telnet'].includes(connectionType);
}
