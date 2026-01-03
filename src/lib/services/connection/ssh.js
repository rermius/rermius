/**
 * SSH Connection Service
 * Handles SSH connection process with logging
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { appDataDir, join } from '@tauri-apps/api/path';
import { tauriFs } from '../infra/tauri/fs';
import { getKey } from '../data/keychain';
import { getHostById } from '../data/hosts';
import { parseChain } from '$lib/utils';

/**
 * Write temporary SSH key file
 * @param {string} keyContent - Private key content
 * @returns {Promise<string>} Path to temporary key file
 */
export async function writeTempKeyFile(keyContent) {
	const appDir = await appDataDir();
	const tempKeysDir = await join(appDir, 'temp_keys');

	// Ensure temp keys directory exists
	const dirExists = await tauriFs.fileExists(tempKeysDir);
	if (!dirExists) {
		await tauriFs.createDir(tempKeysDir, { recursive: true });
	}

	// Create temp key file with unique name
	const keyFileName = `temp_key_${Date.now()}_${crypto.randomUUID()}`;
	const keyPath = await join(tempKeysDir, keyFileName);

	// Write key content
	await tauriFs.writeFile(keyPath, keyContent);

	return keyPath;
}

/**
 * Prepare hop configuration with resolved key path
 * @param {Object} host - Host configuration
 * @returns {Promise<Object>} Hop config for backend
 */
export async function prepareHopConfig(host) {
	let keyPath = null;
	if (host.authMethod === 'key' && host.keyId) {
		const key = getKey(host.keyId);
		if (!key) {
			throw new Error(`SSH key not found for host "${host.label || host.hostname}"`);
		}
		keyPath = await writeTempKeyFile(key.privateKey);
	}

	return {
		hostname: host.hostname,
		port: host.port,
		username: host.username,
		auth_method: host.authMethod,
		key_path: keyPath,
		password: host.password || null
	};
}

/**
 * Resolve host chain IDs to full connection configs
 * @param {Object} host - Target host with proxyJump
 * @returns {Promise<{chain: Array, tempKeyPaths: string[]}>}
 */
export async function resolveChain(host) {
	const chainIds = parseChain(host.proxyJump);
	const chain = [];
	const tempKeyPaths = [];

	// Build chain: [jump1, jump2, ..., target]
	for (const hostId of chainIds) {
		const jumpHost = getHostById(hostId);
		if (!jumpHost) {
			throw new Error(`Jump host not found: ${hostId}`);
		}
		const hopConfig = await prepareHopConfig(jumpHost);
		if (hopConfig.key_path) {
			tempKeyPaths.push(hopConfig.key_path);
		}
		chain.push(hopConfig);
	}

	// Add target host at the end
	const targetConfig = await prepareHopConfig(host);
	if (targetConfig.key_path) {
		tempKeyPaths.push(targetConfig.key_path);
	}
	chain.push(targetConfig);

	return { chain, tempKeyPaths };
}

/**
 * Clean up temporary key files
 * @param {string[]} paths - Array of temp key file paths
 */
export function cleanupTempKeys(paths) {
	if (!paths || paths.length === 0) return;

	// Delay cleanup to avoid race condition with Rust reading the files
	setTimeout(async () => {
		for (const path of paths) {
			try {
				await tauriFs.remove(path);
			} catch (error) {
				console.warn('Failed to remove temp key file:', error);
			}
		}
	}, 2000);
}

/**
 * Connect to SSH host with progress logging
 * Supports host chaining (ProxyJump) through intermediate jump hosts
 * @param {Object} host - Host configuration
 * @param {string} host.hostname - Hostname or IP
 * @param {number} host.port - SSH port
 * @param {string} host.username - SSH username
 * @param {string} host.authMethod - Auth method ('key' | 'password' | 'agent')
 * @param {string} [host.keyId] - SSH key ID (if authMethod === 'key')
 * @param {string} [host.password] - Password (if authMethod === 'password')
 * @param {string} [host.proxyJump] - JSON array of jump host IDs
 * @param {Function} onLog - Callback for each log entry
 * @returns {Promise<{sessionId: string, logs: string[]}>}
 * @throws {Error} If connection fails
 */
export async function connectSSH(host, onLog) {
	const logs = [];
	let tempKeyPaths = [];

	const addLog = (message, detail = '') => {
		const logEntry = detail ? `${message} ${detail}` : message;
		logs.push(logEntry);
		if (onLog) onLog(logEntry);
	};

	try {
		// Check connection type
		const connectionType = host.connectionType || 'ssh';

		// File transfer types should use connectFileTransfer from file-connection.js
		if (connectionType === 'ftp' || connectionType === 'ftps') {
			const typeLabel = connectionType.toUpperCase();
			addLog(`❌ ${typeLabel} requires file browser, not terminal`);
			throw new Error(
				`${typeLabel} connections should use the file browser. Use connectFileTransfer() instead.`
			);
		}

		// Telnet is not yet implemented
		if (connectionType === 'telnet') {
			addLog('❌ Telnet connection is not yet implemented');
			throw new Error('Telnet connection is not yet implemented.');
		}

		// SFTP with terminal - treat as SSH for now
		// Pure SFTP file transfer should use connectFileTransfer from file-connection.js
		if (connectionType === 'sftp') {
			addLog('⚙️ SFTP connection (using SSH terminal)...');
		}

		// Check if this is a chained connection
		const chainIds = parseChain(host.proxyJump);
		const hasChain = chainIds.length > 0;

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

			addLog('⚙️ Establishing chained SSH connection...');

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
				sessionId = await invoke('create_chained_ssh_session', {
					chain,
					cols: 80,
					rows: 24,
					connectionType: connectionType
				});

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
			addLog('⚙️ Starting connection to:', `"${host.hostname}:${host.port}"`);

			// Prepare authentication
			let keyPath = null;
			if (host.authMethod === 'key' && host.keyId) {
				addLog('⚙️ Loading SSH key...');
				const key = getKey(host.keyId);
				if (!key) {
					throw new Error('SSH key not found in keychain');
				}
				keyPath = await writeTempKeyFile(key.privateKey);
				tempKeyPaths.push(keyPath);
				addLog('⚙️ SSH key loaded');
			}

			addLog('⚙️ Establishing SSH connection...');

			let sessionId;
			try {
				sessionId = await invoke('create_ssh_session', {
					hostname: host.hostname,
					port: host.port,
					username: host.username,
					authMethod: host.authMethod,
					keyPath: keyPath,
					password: host.password || null,
					connectionType: connectionType
				});

				addLog('✅ Connected successfully');
			} catch (invokeError) {
				addLog('❌ Connection failed:', invokeError.toString());
				throw invokeError;
			}

			cleanupTempKeys(tempKeyPaths);

			return { sessionId, logs };
		}
	} catch (error) {
		cleanupTempKeys(tempKeyPaths);

		const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
		addLog('❌ Connection failed:', errorMessage);
		throw {
			message: errorMessage,
			logs
		};
	}
}

/**
 * Retry SSH connection
 * @param {Object} host - Host configuration
 * @param {Function} onLog - Callback for each log entry
 * @returns {Promise<{sessionId: string, logs: string[]}>}
 */
export async function retrySSHConnection(host, onLog) {
	// Clear previous logs and retry
	return connectSSH(host, onLog);
}
