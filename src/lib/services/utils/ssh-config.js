/**
 * SSH Config parser service
 * Parses SSH config file (~/.ssh/config) and extracts host configurations
 */
import { tauriFs } from '../infra/tauri/fs';
import { homeDir, join } from '@tauri-apps/api/path';

/**
 * Expand tilde (~) in file paths to home directory
 * @param {string} path - Path that may contain tilde
 * @returns {Promise<string>} Expanded path
 */
async function expandTilde(path) {
	if (path.startsWith('~/')) {
		const home = await homeDir();
		return path.replace('~', home);
	}
	return path;
}

/**
 * Parse SSH config content string
 * @param {string} content - SSH config file content
 * @returns {Array<Object>} Array of host configurations
 */
function parseConfigContent(content) {
	const hosts = [];
	let currentHost = null;

	for (const line of content.split('\n')) {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}

		// Split keyword and value
		const parts = trimmed.split(/\s+/, 2);
		if (parts.length < 2) {
			continue;
		}

		const keyword = parts[0].toLowerCase();
		let value = parts[1].trim();

		// Remove surrounding quotes from value (common in SSH configs)
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		switch (keyword) {
			case 'host': {
				// Save previous host if exists
				if (currentHost) {
					hosts.push(currentHost);
				}

				// Create new host entry
				// Skip wildcard patterns
				const patterns = value.split(/\s+/);
				for (const pattern of patterns) {
					if (!pattern.includes('*') && !pattern.includes('?')) {
						currentHost = {
							name: pattern,
							hostname: pattern,
							port: 22,
							user: null,
							identityFile: null,
							proxyJump: null,
							proxyCommand: null,
							forwardAgent: null,
							otherOptions: {}
						};
						break;
					}
				}
				break;
			}

			case 'hostname': {
				if (currentHost) {
					currentHost.hostname = value;
				}
				break;
			}

			case 'port': {
				if (currentHost) {
					const port = parseInt(value, 10);
					if (!isNaN(port) && port > 0 && port <= 65535) {
						currentHost.port = port;
					}
				}
				break;
			}

			case 'user': {
				if (currentHost) {
					currentHost.user = value;
				}
				break;
			}

			case 'identityfile': {
				if (currentHost) {
					// Take the first identity file if multiple are specified
					if (!currentHost.identityFile) {
						currentHost.identityFile = value;
					}
				}
				break;
			}

			case 'proxyjump': {
				if (currentHost) {
					currentHost.proxyJump = value;
				}
				break;
			}

			case 'proxycommand': {
				if (currentHost) {
					currentHost.proxyCommand = value;
				}
				break;
			}

			case 'forwardagent': {
				if (currentHost) {
					currentHost.forwardAgent = value.toLowerCase() === 'yes';
				}
				break;
			}

			default: {
				// Store other options
				if (currentHost) {
					currentHost.otherOptions[keyword] = value;
				}
				break;
			}
		}
	}

	// Don't forget the last host
	if (currentHost) {
		hosts.push(currentHost);
	}

	return hosts;
}

/**
 * Parse SSH config file and extract host configurations
 * @param {string} configPath - Path to SSH config file (defaults to ~/.ssh/config)
 * @returns {Promise<Array<Object>>} Array of host configurations
 */
export async function parseSSHConfig(configPath = null) {
	let filePath = configPath;

	try {
		// Use default path if not provided
		if (!filePath) {
			const home = await homeDir();
			filePath = await join(home, '.ssh', 'config');
		}

		// Expand tilde if present
		filePath = await expandTilde(filePath);

		// Read config file (let read error surface instead of pre-check to avoid false negatives)
		let content;
		try {
			content = await tauriFs.readFile(filePath);
		} catch (readError) {
			// Normalize "not found" into consistent message
			if (String(readError).toLowerCase().includes('not found')) {
				throw new Error(`SSH config file not found: ${filePath}`);
			}
			throw readError;
		}

		// Parse content
		const hosts = parseConfigContent(content);

		// Expand tilde in identity file paths
		for (const host of hosts) {
			if (host.identityFile) {
				host.identityFile = await expandTilde(host.identityFile);
			}
		}

		return hosts;
	} catch (error) {
		console.error('parseSSHConfig error:', error);
		// Re-throw with more context
		if (error.message?.includes('not found')) {
			throw error; // Already has good message
		}
		throw new Error(`Failed to parse SSH config: ${error.message || String(error)}`);
	}
}
