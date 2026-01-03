/**
 * Composable for SSH config scanning and import operations
 * Handles SSH config parsing, key auto-import, and host import with progress tracking
 */
import { parseSSHConfig, importKeyFromFile, findDuplicateKey, addHost, getHosts, tauriDialog, tauriFs } from '$lib/services';
import { serializeChain } from '$lib/utils';

/**
 * Parse ProxyJump value from SSH config and resolve to host IDs
 * @param {string} proxyJumpValue - Raw ProxyJump value from SSH config (e.g., "jump-host", "user@jump:22", "jump1,jump2")
 * @param {Array} existingHosts - Array of existing hosts to search for matches
 * @param {Map} importedHostsMap - Map of imported host labels to their IDs (for hosts imported in this session)
 * @returns {string|null} Serialized chain of host IDs or null
 */
function resolveProxyJump(proxyJumpValue, existingHosts, importedHostsMap) {
	if (!proxyJumpValue) return null;

	// Split by comma for multiple jumps
	const jumpHostStrings = proxyJumpValue.split(',').map(s => s.trim());
	const resolvedIds = [];

	for (const jumpHostString of jumpHostStrings) {
		// Parse the jump host string (can be "hostname", "user@hostname", "hostname:port", or "user@hostname:port")
		let hostname = jumpHostString;
		let username = null;
		let port = null;

		// Extract user if present
		if (hostname.includes('@')) {
			const parts = hostname.split('@');
			username = parts[0];
			hostname = parts[1];
		}

		// Extract port if present
		if (hostname.includes(':')) {
			const parts = hostname.split(':');
			hostname = parts[0];
			port = parseInt(parts[1], 10);
		}

		// Try to find matching host in:
		// 1. Hosts imported in this session
		// 2. Existing hosts

		// First check imported hosts map
		if (importedHostsMap.has(jumpHostString)) {
			resolvedIds.push(importedHostsMap.get(jumpHostString));
			continue;
		}

		// Then search in existing hosts by label or hostname
		const matchingHost = existingHosts.find(h => {
			// Match by label (exact match)
			if (h.label === jumpHostString || h.label === hostname) {
				return true;
			}

			// Match by hostname
			if (h.hostname === hostname) {
				// If port specified, must match
				if (port && h.port !== port) return false;
				// If username specified, must match
				if (username && h.username !== username) return false;
				return true;
			}

			return false;
		});

		if (matchingHost) {
			resolvedIds.push(matchingHost.id);
		}
		// If no match found, skip this jump host (could log warning)
		else {
			console.warn(`ProxyJump host not found: ${jumpHostString}`);
		}
	}

	// Return serialized chain if any hosts were resolved
	return resolvedIds.length > 0 ? serializeChain(resolvedIds) : null;
}

/**
 * Composable hook for SSH config scanning operations
 * @returns {Object} State and methods for SSH config scanning
 */
export function useSSHConfigScan() {
	let hosts = $state([]);
	let selectedHosts = $state(new Set());
	let isScanning = $state(false);
	let isImporting = $state(false);
	let autoImportKeys = $state(true);
	let importProgress = $state({
		current: 0,
		total: 0,
		success: 0,
		errors: 0,
		duplicates: 0,
		errorDetails: []
	});

	/**
	 * Open file dialog and scan SSH config file
	 */
	async function openAndScanConfig() {
		try {
			isScanning = true;
			selectedHosts = new Set();

			// Open file dialog
			const filePath = await tauriDialog.openFile({
				title: 'Select SSH Config File',
				filters: [
					{
						name: 'SSH Config',
						extensions: ['config']
					},
					{
						name: 'All Files',
						extensions: ['*']
					}
				]
			});

			if (!filePath) {
				isScanning = false;
				return;
			}

			// Parse SSH config
			const parsedHosts = await parseSSHConfig(filePath);
			hosts = parsedHosts;
			isScanning = false;
		} catch (error) {
			console.error('Failed to scan SSH config:', error);
			isScanning = false;
			throw error;
		}
	}

	/**
	 * Scan default SSH config file (~/.ssh/config)
	 */
	async function scanDefaultConfig() {
		try {
			isScanning = true;
			selectedHosts = new Set();

			const parsedHosts = await parseSSHConfig();
			hosts = parsedHosts;
			isScanning = false;
		} catch (error) {
			console.error('Failed to scan default SSH config:', error);
			isScanning = false;
			throw error;
		}
	}

	/**
	 * Toggle host selection
	 */
	function toggleHost(hostName) {
		if (selectedHosts.has(hostName)) {
			selectedHosts.delete(hostName);
		} else {
			selectedHosts.add(hostName);
		}
		selectedHosts = new Set(selectedHosts); // Trigger reactivity
	}

	/**
	 * Toggle all hosts selection
	 */
	function toggleAll() {
		if (selectedHosts.size === hosts.length) {
			selectedHosts = new Set();
		} else {
			selectedHosts = new Set(hosts.map(h => h.name));
		}
	}

	/**
	 * Import selected hosts with optional auto-import of keys
	 */
	async function importSelected() {
		if (selectedHosts.size === 0) {
			return {
				imported: 0,
				duplicates: 0,
				errors: 0,
				errorDetails: []
			};
		}

		isImporting = true;
		const selectedHostNames = Array.from(selectedHosts);
		const hostsToImport = hosts.filter(h => selectedHostNames.includes(h.name));

		importProgress = {
			current: 0,
			total: hostsToImport.length,
			success: 0,
			errors: 0,
			duplicates: 0,
			errorDetails: []
		};

		const summary = {
			imported: 0,
			duplicates: 0,
			errors: 0,
			keysImported: 0,
			errorDetails: [], // Host import errors
			failedKeys: [], // Failed key imports with retry info
			duplicateKeys: [] // Duplicate keys with overwrite info
		};

		// Step 1: Auto-import keys if enabled
		const keyMapping = new Map(); // identityFilePath -> keyId

		if (autoImportKeys) {
			// Collect unique identity file paths
			const identityFilePaths = new Set();
			for (const host of hostsToImport) {
				if (host.identityFile) {
					identityFilePaths.add(host.identityFile);
				}
			}

			// Import each key
			for (const identityFilePath of identityFilePaths) {
				try {
					// Import key directly - let importKeyFromFile handle file existence check
					const result = await importKeyFromFile(identityFilePath, { skipDuplicate: true });

					if (result.status === 'imported') {
						keyMapping.set(identityFilePath, result.key.id);
						summary.keysImported += 1;
						console.log(`✓ Imported key: ${identityFilePath}`);
					} else if (result.status === 'duplicate') {
						// Use existing key ID
						keyMapping.set(identityFilePath, result.duplicateKey.id);
						console.log(`✓ Using existing key: ${identityFilePath}`);
						// Track duplicate for UI (allow overwrite option)
						summary.duplicateKeys.push({
							path: identityFilePath,
							existingKey: result.duplicateKey,
							keyType: result.keyType
						});
					} else {
						// Import failed
						console.error(`✗ Failed to import key from ${identityFilePath}:`, result.error);
						summary.errors += 1;
						summary.failedKeys.push({
							path: identityFilePath,
							error: result.error || 'Failed to import key',
							keyType: result.keyType
						});
					}
				} catch (error) {
					console.error(`✗ Failed to import key from ${identityFilePath}:`, error);
					summary.errors += 1;
					summary.failedKeys.push({
						path: identityFilePath,
						error: error.message || String(error),
						keyType: null
					});
				}
			}
		}

		// Step 2: Import hosts
		// Get existing hosts for ProxyJump resolution
		const existingHosts = getHosts();
		const importedHostsMap = new Map(); // Track hosts imported in this session (label -> id)

		for (const host of hostsToImport) {
			try {
				importProgress.current += 1;
				importProgress = { ...importProgress }; // Trigger reactivity

				// Get keyId from mapping if identity file exists
				const keyId = host.identityFile ? keyMapping.get(host.identityFile) : null;

				// Determine auth method
				// If identityFile was specified but key import failed, still use 'key' auth method
				// This preserves the user's intent even if the key file wasn't found
				const authMethod = host.identityFile ? 'key' : 'password';

				// Resolve ProxyJump to host chain IDs
				const proxyJumpResolved = resolveProxyJump(host.proxyJump, existingHosts, importedHostsMap);

				// Build notes
				let notes = '';
				if (host.proxyCommand) {
					notes += `ProxyCommand: ${host.proxyCommand}\n`;
				}
				if (host.proxyJump && !proxyJumpResolved) {
					notes += `Original ProxyJump: ${host.proxyJump} (could not resolve to existing hosts)\n`;
				}

				const hostData = {
					label: host.name,
					hostname: host.hostname,
					port: host.port,
					username: host.user || 'root',
					authMethod,
					keyId,
					password: null,
					proxyJump: proxyJumpResolved,
					connectionTimeout: 30,
					keepAlive: true,
					keepAliveInterval: 60,
					strictHostKeyChecking: true,
					tags: [],
					notes: notes.trim()
				};

				const addedHost = await addHost(hostData);

				// Track imported host for ProxyJump resolution
				importedHostsMap.set(host.name, addedHost.id);

				summary.imported += 1;
				importProgress.success += 1;
				importProgress = { ...importProgress }; // Trigger reactivity
			} catch (error) {
				summary.errors += 1;
				importProgress.errors += 1;
				importProgress.errorDetails.push({
					host: host.name,
					error: error.message || String(error)
				});
				importProgress = { ...importProgress }; // Trigger reactivity
				console.error(`Failed to import host ${host.name}:`, error);
			}
		}

		isImporting = false;

		// Ensure errorDetails are included in summary
		summary.errorDetails = importProgress.errorDetails;

		return summary;
	}

	/**
	 * Retry importing a failed key
	 * @param {string} keyPath - Path to the key file
	 * @returns {Promise<{success: boolean, key?: object, error?: string}>}
	 */
	async function retryKeyImport(keyPath) {
		try {
			const result = await importKeyFromFile(keyPath, { skipDuplicate: true });

			if (result.status === 'imported') {
				return { success: true, key: result.key };
			} else if (result.status === 'duplicate') {
				return { success: true, key: result.duplicateKey, isDuplicate: true };
			} else {
				return { success: false, error: result.error || 'Failed to import key' };
			}
		} catch (error) {
			return { success: false, error: error.message || String(error) };
		}
	}

	/**
	 * Overwrite a duplicate key
	 * @param {string} keyPath - Path to the key file
	 * @param {string} existingKeyId - ID of the existing key to overwrite
	 * @returns {Promise<{success: boolean, key?: object, error?: string}>}
	 */
	async function overwriteKey(keyPath, existingKeyId) {
		try {
			// First, delete the existing key
			const { deleteKey } = await import('$lib/services');
			await deleteKey(existingKeyId);

			// Then import the new key
			const result = await importKeyFromFile(keyPath, { skipDuplicate: false });

			if (result.status === 'imported') {
				return { success: true, key: result.key };
			} else {
				return { success: false, error: result.error || 'Failed to import key after deletion' };
			}
		} catch (error) {
			return { success: false, error: error.message || String(error) };
		}
	}

	/**
	 * Reset scan state
	 */
	function reset() {
		hosts = [];
		selectedHosts = new Set();
		isScanning = false;
		isImporting = false;
		autoImportKeys = true;
		importProgress = {
			current: 0,
			total: 0,
			success: 0,
			errors: 0,
			duplicates: 0,
			errorDetails: []
		};
	}

	// Derived state (must be at top level)
	const derivedHosts = $derived(hosts);
	const derivedSelectedHosts = $derived(selectedHosts);
	const derivedIsScanning = $derived(isScanning);
	const derivedIsImporting = $derived(isImporting);
	const derivedAutoImportKeys = $derived.by(() => autoImportKeys);
	const derivedImportProgress = $derived(importProgress);
	const derivedSelectedCount = $derived(selectedHosts.size);

	return {
		// State
		get hosts() {
			return derivedHosts;
		},
		get selectedHosts() {
			return derivedSelectedHosts;
		},
		get isScanning() {
			return derivedIsScanning;
		},
		get isImporting() {
			return derivedIsImporting;
		},
		get autoImportKeys() {
			return derivedAutoImportKeys;
		},
		get importProgress() {
			return derivedImportProgress;
		},
		get selectedCount() {
			return derivedSelectedCount;
		},

		// Methods
		openAndScanConfig,
		scanDefaultConfig,
		toggleHost,
		toggleAll,
		importSelected,
		retryKeyImport,
		overwriteKey,
		reset,
		setAutoImportKeys: value => {
			autoImportKeys = value;
		}
	};
}
