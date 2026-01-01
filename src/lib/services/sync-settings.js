/**
 * Sync Settings Service
 * Handles loading/saving sync configuration from/to JSON file
 */

import { tauriFs } from './tauri/fs.js';
import { syncSettingsStore } from '../stores/sync-settings.store.js';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';
import { get } from 'svelte/store';
import { decryptData, encryptData } from '../utils/crypto.js';
import { getCurrentWorkspaceId } from './workspaces.js';

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
	const result = { ...target };

	for (const key in source) {
		if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
			result[key] = deepMerge(target[key] || {}, source[key]);
		} else {
			result[key] = source[key];
		}
	}

	return result;
}

/**
 * Safely parse JSON content, handling corrupted files with trailing content
 * @param {string} content - File content to parse
 * @returns {Object|null} Parsed JSON object or null if parsing fails
 */
function safeJsonParse(content) {
	if (!content || typeof content !== 'string') {
		return null;
	}

	// Trim whitespace
	content = content.trim();

	if (!content) {
		return null;
	}

	// Try direct parse first
	try {
		return JSON.parse(content);
	} catch (error) {
		// If parsing fails, try to extract valid JSON
		// Look for the first complete JSON object by finding matching braces
		let braceCount = 0;
		let inString = false;
		let escapeNext = false;
		let jsonEnd = -1;

		for (let i = 0; i < content.length; i++) {
			const char = content[i];

			if (escapeNext) {
				escapeNext = false;
				continue;
			}

			if (char === '\\') {
				escapeNext = true;
				continue;
			}

			if (char === '"' && !escapeNext) {
				inString = !inString;
				continue;
			}

			if (!inString) {
				if (char === '{') {
					braceCount++;
				} else if (char === '}') {
					braceCount--;
					if (braceCount === 0) {
						jsonEnd = i + 1;
						break;
					}
				}
			}
		}

		// If we found a complete JSON object, try parsing just that part
		if (jsonEnd > 0) {
			try {
				const jsonPart = content.substring(0, jsonEnd).trim();
				return JSON.parse(jsonPart);
			} catch (e) {
				// Still failed, return null
			}
		}

		// Last resort: try to find JSON between first { and last }
		const firstBrace = content.indexOf('{');
		const lastBrace = content.lastIndexOf('}');

		if (firstBrace >= 0 && lastBrace > firstBrace) {
			try {
				const jsonPart = content.substring(firstBrace, lastBrace + 1);
				return JSON.parse(jsonPart);
			} catch (e) {
				// Still failed
			}
		}

		return null;
	}
}

/**
 * Get sync settings file path
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
async function getSyncSettingsFilePath(workspaceId = null) {
	const appDataDirPath = await appDataDir();
	const wsId = workspaceId || getCurrentWorkspaceId();

	if (!wsId) {
		throw new Error('No workspace ID available');
	}

	return await join(appDataDirPath, 'workspaces', wsId, 'sync-settings.json');
}

/**
 * Load sync settings from file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 * @returns {Promise<Object>}
 */
/**
 * Get default sync settings structure
 * @returns {Object} Default settings object
 */
function getDefaultSyncSettings() {
	return {
		__loaded: false,
		activeTab: 'github',
		github: {
			token: '',
			gist: '',
			encryptPassword: '',
			isValidated: false
		},
		gitee: {
			token: '',
			gist: '',
			encryptPassword: '',
			isValidated: false
		},
		custom: {
			url: '',
			token: '',
			encryptPassword: '',
			isValidated: false
		},
		cloud: {
			provider: 'none',
			credentials: {},
			encryptPassword: '',
			isValidated: false
		},
		syncOptions: {
			settings: true,
			bookmarks: true,
			terminalThemes: true,
			quickCommands: true,
			profiles: true,
			addressBookmarks: true
		},
		lastSync: {
			lastUpload: null,
			lastDownload: null
		},
		autoSync: {
			enabled: false
		},
		syncVersion: {
			lastKnownVersion: null,
			latestRemoteVersion: null,
			latestRemoteTimestamp: null,
			lastCheckTime: null,
			isChecking: false,
			checkError: null
		}
	};
}

export async function loadSyncSettings(workspaceId = null) {
	try {
		const filePath = await getSyncSettingsFilePath(workspaceId);

		// Reset store to defaults first to clear any previous workspace data
		const defaultSettings = getDefaultSyncSettings();
		syncSettingsStore.reset();

		// Check if file exists
		const exists = await tauriFs.fileExists(filePath);

		if (!exists) {
			// Initialize with default settings on first run
			await saveSyncSettings(defaultSettings, workspaceId);
			return defaultSettings;
		}

		// File exists, read it
		const content = await tauriFs.readFile(filePath);
		const loadedSettings = safeJsonParse(content);

		if (!loadedSettings) {
			console.warn(
				'[loadSyncSettings] File contains invalid JSON, backing up and resetting to defaults'
			);
			// Backup corrupted file
			try {
				const backupPath = filePath + '.corrupted.' + Date.now();
				await tauriFs.writeFile(backupPath, content);
				console.warn(`[loadSyncSettings] Corrupted file backed up to: ${backupPath}`);
			} catch (backupError) {
				console.warn('[loadSyncSettings] Failed to backup corrupted file:', backupError);
			}
			// Initialize with default settings
			await saveSyncSettings(defaultSettings, workspaceId);
			syncSettingsStore.set({ ...defaultSettings, __loaded: true });
			return defaultSettings;
		}

		// Merge with defaults to ensure all fields exist
		const mergedSettings = deepMerge(defaultSettings, loadedSettings);

		syncSettingsStore.set({ ...mergedSettings, __loaded: true });
		return mergedSettings;
	} catch (error) {
		console.error('[loadSyncSettings] Failed to load sync settings:', error);
		// Reset to defaults on error
		syncSettingsStore.reset();
		return null;
	}
}

/**
 * Save sync settings to file
 * @param {Object} settings - Sync settings object
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 * @returns {Promise<void>}
 */
export async function saveSyncSettings(settings, workspaceId = null) {
	try {
		const filePath = await getSyncSettingsFilePath(workspaceId);
		const { __loaded, ...persistable } = settings || {};

		// Ensure the workspace directory exists
		const wsId = workspaceId || getCurrentWorkspaceId();
		if (!wsId) {
			throw new Error('No workspace ID available');
		}

		const appDataDirPath = await appDataDir();
		const workspaceDir = await join(appDataDirPath, 'workspaces', wsId);
		await tauriFs.createDir(workspaceDir, { recursive: true });

		// Save settings
		await tauriFs.writeFile(filePath, JSON.stringify(persistable, null, 2));
	} catch (error) {
		console.error('Failed to save sync settings:', error);
		throw error;
	}
}

/**
 * Clear sync settings
 * @returns {Promise<void>}
 */
export async function clearSyncSettings() {
	try {
		syncSettingsStore.reset();

		// Delete the file if it exists
		const filePath = await getSyncSettingsFilePath();
		const exists = await tauriFs.fileExists(filePath);
		if (exists) {
			await tauriFs.remove(filePath);
		}
	} catch (error) {
		console.error('Failed to clear sync settings:', error);
		throw error;
	}
}

/**
 * Validate GitHub credentials and gist data
 * @param {Object} options - Validation options
 * @param {string} options.token - GitHub personal access token
 * @param {string} options.gist - Gist ID (optional - if empty, only validates token)
 * @param {string} options.encryptPassword - Encryption password
 * @param {Function} options.onLog - Callback for logging progress
 * @returns {Promise<{success: boolean, message: string, gistExists: boolean}>}
 */
/**
 * Download and decrypt data from GitHub Gist
 * @param {Object} options - Download options
 * @param {string} options.token - GitHub personal access token
 * @param {string} options.gist - Gist ID
 * @param {string} options.encryptPassword - Encryption password
 * @param {Function} options.onLog - Callback for logging progress
 * @returns {Promise<{success: boolean, data: Object|null, message: string}>}
 */
export async function downloadFromGitHub({ token, gist, encryptPassword, onLog = () => {} }) {
	try {
		// Step 1: Validate inputs
		if (!gist || !gist.trim()) {
			return { success: false, data: null, message: 'Gist ID is required for download' };
		}

		// Step 2: Fetch the gist
		onLog('Connecting to GitHub API...', 'info');

		const response = await fetch(`https://api.github.com/gists/${gist}`, {
			headers: {
				Authorization: `token ${token}`,
				Accept: 'application/vnd.github.v3+json'
			}
		});

		if (!response.ok) {
			if (response.status === 401) {
				return { success: false, data: null, message: 'Invalid GitHub token' };
			}
			if (response.status === 404) {
				return { success: false, data: null, message: 'Gist not found' };
			}
			return { success: false, data: null, message: `GitHub API error: ${response.status}` };
		}

		const gistData = await response.json();
		onLog('Gist fetched successfully', 'success');

		const files = gistData.files || {};

		// Multi-part files (new format only)
		const hostsFile = files['hosts.enc'];
		const groupsFile = files['groups.enc'];
		const settingsFile = files['settings.enc'];
		const snippetsFile = files['snippets.enc'];
		const keychainFile = files['keychain.enc'];

		if (!hostsFile && !groupsFile && !settingsFile && !snippetsFile && !keychainFile) {
			return { success: false, data: null, message: 'No backup data found in gist' };
		}

		// Step 3: Decrypt available parts
		const resultData = {};

		// Helper to decrypt a single file
		async function decryptPart(file, label) {
			if (!file || !file.content) return null;
			onLog(`Decrypting ${label}...`, 'info');
			const decrypted = await decryptData(file.content, encryptPassword);
			if (!decrypted || typeof decrypted !== 'object') {
				throw new Error(`Invalid ${label} format after decryption`);
			}
			return decrypted;
		}

		try {
			// Multi-part backup
			if (hostsFile) {
				const hostsData = await decryptPart(hostsFile, 'hosts');
				// Support both { hosts: [...] } and raw array
				resultData.hosts = Array.isArray(hostsData.hosts)
					? hostsData.hosts
					: hostsData.hosts || hostsData;
				onLog(`Decrypted hosts: ${resultData.hosts?.length || 0} item(s)`, 'success');
			}

			if (groupsFile) {
				const groupsData = await decryptPart(groupsFile, 'groups');
				resultData.groups = Array.isArray(groupsData.groups)
					? groupsData.groups
					: groupsData.groups || groupsData;
				onLog(`Decrypted groups: ${resultData.groups?.length || 0} item(s)`, 'success');
			}

			if (settingsFile) {
				const settingsData = await decryptPart(settingsFile, 'settings');
				// Expect shape: { version, metadata, settings }
				if (settingsData.version) {
					resultData.version = settingsData.version;
				}
				if (settingsData.metadata) {
					resultData.metadata = settingsData.metadata;
				}
				if (settingsData.settings) {
					resultData.settings = settingsData.settings;
				}
				onLog('Decrypted settings & metadata', 'success');
			}

			if (snippetsFile) {
				const snippetsData = await decryptPart(snippetsFile, 'snippets');
				// Support both { snippets: [...] } and raw array
				resultData.snippets = Array.isArray(snippetsData.snippets)
					? snippetsData.snippets
					: snippetsData.snippets || snippetsData;
				onLog(`Decrypted snippets: ${resultData.snippets?.length || 0} item(s)`, 'success');
			}

			if (keychainFile) {
				const keychainData = await decryptPart(keychainFile, 'keychain');
				// Expect shape: { keys: [...], vaults: [...] }
				if (keychainData.keys) {
					resultData.keys = keychainData.keys;
				}
				if (keychainData.vaults) {
					resultData.vaults = keychainData.vaults;
				}
				onLog(`Decrypted keychain: ${resultData.keys?.length || 0} key(s)`, 'success');
			}

			if (!Object.keys(resultData).length) {
				return {
					success: false,
					data: null,
					message: 'No supported backup parts found after decryption'
				};
			}

			return { success: true, data: resultData, message: 'Download successful' };
		} catch (decryptError) {
			onLog('Decryption failed - wrong password or corrupted data', 'error');
			return { success: false, data: null, message: 'Wrong encrypt password or corrupted data' };
		}
	} catch (error) {
		console.error('Download failed:', error);
		return { success: false, data: null, message: `Download error: ${error.message}` };
	}
}

/**
 * Get Gist commit history (upload history) with pagination
 * @param {string} token - GitHub personal access token
 * @param {string} gistId - Gist ID
 * @param {number} page - Page number (1-based)
 * @param {number} perPage - Items per page (default 10)
 * @returns {Promise<{success: boolean, commits: Array, hasMore: boolean, message: string}>}
 */
export async function getGistHistory(token, gistId, page = 1, perPage = 10) {
	try {
		if (!gistId || !gistId.trim()) {
			return { success: false, commits: [], hasMore: false, message: 'Gist ID is required' };
		}

		const response = await fetch(
			`https://api.github.com/gists/${gistId}/commits?page=${page}&per_page=${perPage}`,
			{
				headers: {
					Authorization: `token ${token}`,
					Accept: 'application/vnd.github.v3+json'
				},
				cache: 'no-store'
			}
		);

		if (!response.ok) {
			if (response.status === 401) {
				return { success: false, commits: [], hasMore: false, message: 'Invalid GitHub token' };
			}
			if (response.status === 404) {
				return { success: false, commits: [], hasMore: false, message: 'Gist not found' };
			}
			return {
				success: false,
				commits: [],
				hasMore: false,
				message: `GitHub API error: ${response.status}`
			};
		}

		const commits = await response.json();

		// Check if there's more pages (GitHub returns Link header)
		const linkHeader = response.headers.get('Link');
		const hasMore = linkHeader ? linkHeader.includes('rel="next"') : commits.length === perPage;

		// Map to simpler format
		const history = commits.map((commit, index) => ({
			sha: commit.version,
			date: commit.committed_at,
			changeCount: commit.change_status?.total || 0,
			isLatest: page === 1 && index === 0
		}));

		return { success: true, commits: history, hasMore, message: 'History fetched successfully' };
	} catch (error) {
		console.error('Failed to get gist history:', error);
		return { success: false, commits: [], hasMore: false, message: `Error: ${error.message}` };
	}
}

/**
 * Download a specific version of Gist by SHA
 * @param {Object} options - Download options
 * @param {string} options.token - GitHub personal access token
 * @param {string} options.gistId - Gist ID
 * @param {string} options.sha - Commit SHA to download
 * @param {string} options.encryptPassword - Encryption password
 * @param {Function} options.onLog - Callback for logging progress
 * @returns {Promise<{success: boolean, data: Object|null, message: string}>}
 */
export async function downloadGistVersion({
	token,
	gistId,
	sha,
	encryptPassword,
	onLog = () => {}
}) {
	try {
		if (!gistId || !sha) {
			return { success: false, data: null, message: 'Gist ID and SHA are required' };
		}

		onLog(`Fetching version ${sha.substring(0, 7)}...`, 'info');

		const response = await fetch(`https://api.github.com/gists/${gistId}/${sha}`, {
			headers: {
				Authorization: `token ${token}`,
				Accept: 'application/vnd.github.v3+json'
			}
		});

		if (!response.ok) {
			if (response.status === 404) {
				return { success: false, data: null, message: 'Version not found' };
			}
			return { success: false, data: null, message: `GitHub API error: ${response.status}` };
		}

		const gistData = await response.json();
		onLog('Version fetched, decrypting...', 'info');

		const files = gistData.files || {};
		const hostsFile = files['hosts.enc'];
		const groupsFile = files['groups.enc'];
		const settingsFile = files['settings.enc'];
		const snippetsFile = files['snippets.enc'];
		const keychainFile = files['keychain.enc'];

		if (!hostsFile && !groupsFile && !settingsFile && !snippetsFile && !keychainFile) {
			return { success: false, data: null, message: 'No backup data found in this version' };
		}

		const resultData = {};

		async function decryptPart(file, label) {
			if (!file || !file.content) return null;
			onLog(`Decrypting ${label}...`, 'info');
			const decrypted = await decryptData(file.content, encryptPassword);
			if (!decrypted || typeof decrypted !== 'object') {
				throw new Error(`Invalid ${label} format after decryption`);
			}
			return decrypted;
		}

		try {
			if (hostsFile) {
				const hostsData = await decryptPart(hostsFile, 'hosts');
				resultData.hosts = Array.isArray(hostsData.hosts)
					? hostsData.hosts
					: hostsData.hosts || hostsData;
				onLog(`Decrypted hosts: ${resultData.hosts?.length || 0} item(s)`, 'success');
			}

			if (groupsFile) {
				const groupsData = await decryptPart(groupsFile, 'groups');
				resultData.groups = Array.isArray(groupsData.groups)
					? groupsData.groups
					: groupsData.groups || groupsData;
				onLog(`Decrypted groups: ${resultData.groups?.length || 0} item(s)`, 'success');
			}

			if (settingsFile) {
				const settingsData = await decryptPart(settingsFile, 'settings');
				if (settingsData.version) resultData.version = settingsData.version;
				if (settingsData.metadata) resultData.metadata = settingsData.metadata;
				if (settingsData.settings) resultData.settings = settingsData.settings;
				onLog('Decrypted settings & metadata', 'success');
			}

			if (snippetsFile) {
				const snippetsData = await decryptPart(snippetsFile, 'snippets');
				resultData.snippets = Array.isArray(snippetsData.snippets)
					? snippetsData.snippets
					: snippetsData.snippets || snippetsData;
				onLog(`Decrypted snippets: ${resultData.snippets?.length || 0} item(s)`, 'success');
			}

			if (keychainFile) {
				const keychainData = await decryptPart(keychainFile, 'keychain');
				if (keychainData.keys) {
					resultData.keys = keychainData.keys;
				}
				if (keychainData.vaults) {
					resultData.vaults = keychainData.vaults;
				}
				onLog(`Decrypted keychain: ${resultData.keys?.length || 0} key(s)`, 'success');
			}

			return { success: true, data: resultData, message: 'Version downloaded successfully' };
		} catch (decryptError) {
			onLog('Decryption failed - wrong password or corrupted data', 'error');
			return { success: false, data: null, message: 'Wrong encrypt password or corrupted data' };
		}
	} catch (error) {
		console.error('Download version failed:', error);
		return { success: false, data: null, message: `Error: ${error.message}` };
	}
}

export async function validateGitHubCredentials({
	token,
	gist,
	encryptPassword,
	onLog = () => {}
}) {
	try {
		// Step 1: Validate token by fetching user info
		onLog('Validating GitHub token...', 'info');

		const userResponse = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `token ${token}`,
				Accept: 'application/vnd.github.v3+json'
			}
		});

		if (!userResponse.ok) {
			if (userResponse.status === 401) {
				return { success: false, message: 'Invalid GitHub token', gistExists: false };
			}
			return {
				success: false,
				message: `GitHub API error: ${userResponse.status}`,
				gistExists: false
			};
		}

		const user = await userResponse.json();
		onLog(`Token valid for user: ${user.login}`, 'success');

		// Step 2: If no gist ID provided, validation passes (new gist will be created on upload)
		if (!gist || !gist.trim()) {
			onLog('No gist ID provided - will create new gist on first upload', 'info');
			return { success: true, message: 'Token validated successfully', gistExists: false };
		}

		// Step 3: Fetch the gist to verify it exists and is accessible
		onLog(`Fetching gist: ${gist}...`, 'info');

		const gistResponse = await fetch(`https://api.github.com/gists/${gist}`, {
			headers: {
				Authorization: `token ${token}`,
				Accept: 'application/vnd.github.v3+json'
			}
		});

		if (!gistResponse.ok) {
			if (gistResponse.status === 404) {
				return { success: false, message: 'Gist not found or not accessible', gistExists: false };
			}
			return {
				success: false,
				message: `Failed to fetch gist: ${gistResponse.status}`,
				gistExists: false
			};
		}

		const gistData = await gistResponse.json();
		onLog('Gist found, checking for encrypted data...', 'success');

		// Step 4: Check if the gist contains any encrypted data file (new multi-part format)
		const files = gistData.files || {};
		const encryptedFile = files['hosts.enc'] || files['settings.enc'] || files['groups.enc'];

		if (!encryptedFile || !encryptedFile.content) {
			onLog('Gist exists but has no encrypted data - ready for first upload', 'info');
			return { success: true, message: 'Gist validated (empty)', gistExists: true };
		}

		// Step 5: Try to decrypt the data to verify password
		onLog('Verifying encrypt password by decrypting data...', 'info');

		try {
			const decrypted = await decryptData(encryptedFile.content, encryptPassword);

			// Check if decrypted data looks valid
			if (decrypted && typeof decrypted === 'object') {
				const hostsCount = decrypted.hosts?.length || 0;
				onLog(`Password verified! Found ${hostsCount} hosts in backup (if present)`, 'success');
				return { success: true, message: 'Credentials validated successfully', gistExists: true };
			} else {
				return { success: false, message: 'Decrypted data is invalid', gistExists: true };
			}
		} catch (decryptError) {
			onLog('Failed to decrypt - wrong password or corrupted data', 'error');
			return {
				success: false,
				message: 'Wrong encrypt password or corrupted data',
				gistExists: true
			};
		}
	} catch (error) {
		console.error('Validation failed:', error);
		return { success: false, message: `Validation error: ${error.message}`, gistExists: false };
	}
}

/**
 * Build encrypted parts from hosts data based on sync options
 * @param {Object} hostsData - Hosts store data
 * @param {Object} syncOptions - Sync options (profiles, addressBookmarks, settings, quickCommands, etc.)
 * @param {string} password - Encryption password
 * @param {Function} onLog - Callback for logging progress (optional)
 * @param {Object} snippetsData - Snippets store data (optional)
 * @param {Object} keychainData - Keychain store data (optional)
 * @returns {Promise<Object>} Encrypted parts object
 */
export async function buildEncryptedParts(
	hostsData,
	syncOptions,
	password,
	onLog = () => {},
	snippetsData = null,
	keychainData = null
) {
	const encryptPromises = [];
	const partNames = [];

	if (syncOptions.profiles && hostsData.hosts) {
		onLog('Including hosts (profiles) in sync...', 'info');
		partNames.push('hosts');
		encryptPromises.push(encryptData({ hosts: hostsData.hosts }, password));
	}

	if (syncOptions.addressBookmarks && hostsData.groups) {
		onLog('Including groups (address bookmarks) in sync...', 'info');
		partNames.push('groups');
		encryptPromises.push(encryptData({ groups: hostsData.groups }, password));
	}

	if (syncOptions.settings) {
		onLog('Including settings & metadata in sync...', 'info');
		partNames.push('settings');
		encryptPromises.push(
			encryptData(
				{
					version: hostsData.version,
					metadata: hostsData.metadata,
					settings: hostsData.settings
				},
				password
			)
		);
	}

	if (syncOptions.quickCommands && snippetsData && snippetsData.snippets) {
		onLog('Including snippets (quick commands) in sync...', 'info');
		partNames.push('snippets');
		encryptPromises.push(encryptData({ snippets: snippetsData.snippets }, password));
	}

	// Always sync keychain if keys exist (not tied to any specific sync option)
	if (keychainData && keychainData.keys && keychainData.keys.length > 0) {
		onLog('Including keychain (SSH keys) in sync...', 'info');
		partNames.push('keychain');
		encryptPromises.push(
			encryptData(
				{
					keys: keychainData.keys,
					vaults: keychainData.vaults
				},
				password
			)
		);
	}

	if (encryptPromises.length === 0) {
		return {};
	}

	// Encrypt all parts in parallel
	const encryptedResults = await Promise.all(encryptPromises);

	const encryptedParts = {};
	partNames.forEach((name, i) => {
		encryptedParts[name] = encryptedResults[i];
		onLog(`${name} encrypted`, 'success');
	});

	return encryptedParts;
}

/**
 * Upload encrypted data to GitHub Gist
 * @param {Object} options - Upload options
 * @param {string} options.token - GitHub personal access token
 * @param {string} options.gistId - Gist ID (optional - creates new if empty)
 * @param {Object} options.encryptedParts - Object with encrypted data parts (hosts, groups, settings)
 * @param {string} options.source - Source identifier (e.g. 'rermius', 'rermius-autosync')
 * @param {Function} options.onLog - Callback for logging progress (optional)
 * @returns {Promise<{success: boolean, gistId: string|null, message: string}>}
 */
export async function uploadToGitHub({
	token,
	gistId,
	encryptedParts,
	source = 'rermius',
	onLog = () => {}
}) {
	try {
		onLog('Connecting to GitHub API...', 'info');

		// Prepare gist files
		const files = {
			'metadata.json': {
				content: JSON.stringify(
					{
						version: '1.0.0',
						encrypted: true,
						timestamp: new Date().toISOString(),
						source,
						parts: Object.keys(encryptedParts)
					},
					null,
					2
				)
			}
		};

		if (encryptedParts.hosts) {
			files['hosts.enc'] = { content: encryptedParts.hosts };
		}
		if (encryptedParts.groups) {
			files['groups.enc'] = { content: encryptedParts.groups };
		}
		if (encryptedParts.settings) {
			files['settings.enc'] = { content: encryptedParts.settings };
		}
		if (encryptedParts.snippets) {
			files['snippets.enc'] = { content: encryptedParts.snippets };
		}
		if (encryptedParts.keychain) {
			files['keychain.enc'] = { content: encryptedParts.keychain };
		}

		const gistData = {
			description: 'Rermius SSH Sync (Encrypted, multi-part)',
			public: false,
			files
		};

		let response;
		if (gistId && gistId.trim()) {
			onLog(`Updating existing gist: ${gistId}`, 'info');
			response = await fetch(`https://api.github.com/gists/${gistId}`, {
				method: 'PATCH',
				headers: {
					Authorization: `token ${token}`,
					Accept: 'application/vnd.github.v3+json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(gistData)
			});
		} else {
			onLog('Creating new gist...', 'info');
			response = await fetch('https://api.github.com/gists', {
				method: 'POST',
				headers: {
					Authorization: `token ${token}`,
					Accept: 'application/vnd.github.v3+json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(gistData)
			});
		}

		if (!response.ok) {
			const errorData = await response.json();
			return {
				success: false,
				gistId: null,
				message: errorData.message || `HTTP ${response.status}`
			};
		}

		const result = await response.json();
		onLog('Upload successful!', 'success');

		return { success: true, gistId: result.id, message: 'Upload successful' };
	} catch (error) {
		console.error('Upload failed:', error);
		return { success: false, gistId: null, message: error.message };
	}
}
