/**
 * Application Settings Service
 * Manages workspace application settings including auto-reconnect configuration
 */
import { tauriFs } from './tauri/fs';
import { writable, get } from 'svelte/store';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';
import { getCurrentWorkspaceId } from './workspaces.js';
import { isWin } from '$lib/utils/path/file-utils';

// Platform detection
const isMac =
	typeof window !== 'undefined' &&
	(navigator.platform.includes('Mac') || navigator.userAgent.includes('Macintosh'));

// Default settings structure
const defaultSettings = {
	version: '1.0.0',
	metadata: {
		lastModified: new Date().toISOString()
	},
	autoReconnect: {
		enabled: true,
		maxRetries: 3,
		delay: 5000, // Base delay in milliseconds (exponential backoff applies)
		maxTotalTime: 300000 // Maximum total reconnect time (5 minutes)
	},
	heartbeat: {
		enabled: true,
		interval: 30000, // Ping interval in milliseconds (30s)
		timeout: 10000, // Ping timeout in milliseconds (10s)
		maxFailures: 2 // Max consecutive failures before triggering reconnect
	},
	ui: {
		// Layout modes per feature (independent)
		hostLayoutMode: 'grid', // hosts/home/group
		keychainLayoutMode: 'grid',
		snippetsLayoutMode: 'grid',
		// Split ratio (percentage) of terminal area when file manager split view is enabled
		terminalFileSplitWidth: 50
	},
	// Keyboard shortcuts
	shortcuts: {
		newTerminal: 'Ctrl+T',
		closeTab: 'Ctrl+W',
		nextTab: 'Ctrl+Tab',
		prevTab: 'Ctrl+Shift+Tab',
		openSettings: 'Ctrl+,',
		toggleFileManager: 'Ctrl+B',
		// File browser shortcuts (use Shift modifier to avoid conflict with text editing)
		copyFile: 'Ctrl+Shift+C',
		cutFile: 'Ctrl+Shift+X',
		pasteFile: 'Ctrl+Shift+V',
		selectAllFiles: 'Ctrl+Shift+A',
		deleteFile: 'Delete',
		renameFile: 'F2',
		refreshFileList: 'F5'
	},
	// Shell preferences per OS
	shellPreferences: {
		windows: {
			defaultShell: 'powershell.exe',
			availableShells: [
				{ label: 'PowerShell', value: 'powershell.exe', icon: null },
				{ label: 'Git Bash', value: 'C:\\Program Files\\Git\\bin\\bash.exe', icon: null },
				{ label: 'Command Prompt', value: 'cmd.exe', icon: null },
				{ label: 'WSL', value: 'wsl.exe', icon: null }
			]
		},
		macos: {
			defaultShell: '/bin/zsh',
			availableShells: [
				{ label: 'Zsh', value: '/bin/zsh', icon: null },
				{ label: 'Bash', value: '/bin/bash', icon: null }
			]
		},
		linux: {
			defaultShell: '/bin/bash',
			availableShells: [
				{ label: 'Bash', value: '/bin/bash', icon: null },
				{ label: 'Zsh', value: '/bin/zsh', icon: null },
				{ label: 'Fish', value: '/usr/bin/fish', icon: null }
			]
		}
	}
};

// Settings store
export const appSettingsStore = writable(defaultSettings);

/**
 * Get settings file path
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
async function getSettingsFilePath(workspaceId = null) {
	const appDataDirPath = await appDataDir();
	const wsId = workspaceId || getCurrentWorkspaceId();

	if (!wsId) {
		throw new Error('No workspace ID available');
	}

	return await join(appDataDirPath, 'workspaces', wsId, 'app-settings.json');
}

/**
 * Load settings from file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
export async function loadSettings(workspaceId = null) {
	try {
		const filePath = await getSettingsFilePath(workspaceId);
		const content = await tauriFs.readFile(filePath);
		const data = JSON.parse(content);

		// Migration: Merge with defaults if shortcuts are missing or empty
		if (!data.shortcuts || Object.keys(data.shortcuts).length === 0) {
			data.shortcuts = { ...defaultSettings.shortcuts };
			// Save the migrated data
			appSettingsStore.set(data);
			await saveSettings(workspaceId);
		} else {
			appSettingsStore.set(data);
		}

		return data;
	} catch (error) {
		console.warn('Failed to load app settings, using default:', error);
		// Initialize store with default settings before saving
		appSettingsStore.set(defaultSettings);
		// Save default settings to file
		await saveSettings(workspaceId);
		return defaultSettings;
	}
}

/**
 * Save settings to file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
export async function saveSettings(workspaceId = null) {
	try {
		const filePath = await getSettingsFilePath(workspaceId);

		// Ensure the workspace directory exists
		const wsId = workspaceId || getCurrentWorkspaceId();
		if (!wsId) {
			throw new Error('No workspace ID available');
		}

		const appDataDirPath = await appDataDir();
		const workspaceDir = await join(appDataDirPath, 'workspaces', wsId);
		const dirExists = await tauriFs.fileExists(workspaceDir);
		if (!dirExists) {
			await tauriFs.createDir(workspaceDir, { recursive: true });
		}

		const data = get(appSettingsStore);
		data.metadata.lastModified = new Date().toISOString();
		const content = JSON.stringify(data, null, 2);
		await tauriFs.writeFile(filePath, content);
		return true;
	} catch (error) {
		console.error('Failed to save app settings:', error);
		throw error;
	}
}

/**
 * Get current auto-reconnect settings
 * @returns {Object} Auto-reconnect configuration
 */
export function getAutoReconnectSettings() {
	const data = get(appSettingsStore);
	return {
		enabled: data.autoReconnect?.enabled ?? defaultSettings.autoReconnect.enabled,
		maxRetries: data.autoReconnect?.maxRetries ?? defaultSettings.autoReconnect.maxRetries,
		delay: data.autoReconnect?.delay ?? defaultSettings.autoReconnect.delay,
		maxTotalTime: data.autoReconnect?.maxTotalTime ?? defaultSettings.autoReconnect.maxTotalTime
	};
}

/**
 * Get current heartbeat settings
 * @returns {Object} Heartbeat configuration
 */
export function getHeartbeatSettings() {
	const data = get(appSettingsStore);
	return {
		enabled: data.heartbeat?.enabled ?? defaultSettings.heartbeat.enabled,
		interval: data.heartbeat?.interval ?? defaultSettings.heartbeat.interval,
		timeout: data.heartbeat?.timeout ?? defaultSettings.heartbeat.timeout,
		maxFailures: data.heartbeat?.maxFailures ?? defaultSettings.heartbeat.maxFailures
	};
}

/**
 * Get current UI settings
 * @returns {Object} UI configuration
 */
export function getUiSettings() {
	const data = get(appSettingsStore);
	return {
		hostLayoutMode: data.ui?.hostLayoutMode ?? defaultSettings.ui.hostLayoutMode,
		keychainLayoutMode: data.ui?.keychainLayoutMode ?? defaultSettings.ui.keychainLayoutMode,
		snippetsLayoutMode: data.ui?.snippetsLayoutMode ?? defaultSettings.ui.snippetsLayoutMode,
		terminalFileSplitWidth:
			data.ui?.terminalFileSplitWidth ?? defaultSettings.ui.terminalFileSplitWidth
	};
}

/**
 * Update UI settings
 * @param {Object} updates - Settings to update
 * @param {'grid'|'list'} [updates.homeLayoutMode]
 * @param {number} [updates.terminalFileSplitWidth]
 */
export async function updateUiSettings(updates) {
	const data = get(appSettingsStore);

	const updatedData = {
		...data,
		ui: {
			...data.ui,
			...updates
		}
	};

	appSettingsStore.set(updatedData);
	await saveSettings();
	return updatedData.ui;
}

/**
 * Update auto-reconnect settings
 * @param {Object} updates - Settings to update
 * @param {boolean} [updates.enabled] - Enable/disable auto-reconnect
 * @param {number} [updates.maxRetries] - Maximum number of retry attempts
 * @param {number} [updates.delay] - Delay between retries in milliseconds
 */
export async function updateAutoReconnectSettings(updates) {
	const data = get(appSettingsStore);

	const updatedData = {
		...data,
		autoReconnect: {
			...data.autoReconnect,
			...updates
		}
	};

	appSettingsStore.set(updatedData);
	await saveSettings();
	return updatedData.autoReconnect;
}

/**
 * Get current keyboard shortcuts
 * @returns {Object} Keyboard shortcuts configuration
 */
export function getShortcuts() {
	const data = get(appSettingsStore);
	return {
		...defaultSettings.shortcuts,
		...(data.shortcuts || {})
	};
}

/**
 * Get shell preferences for a specific platform
 * @param {string} platform - 'windows' | 'macos' | 'linux'
 * @returns {Object} Shell preferences for the platform
 */
export function getShellPreferences(platform = null) {
	const data = get(appSettingsStore);
	const targetPlatform = platform || (isWin ? 'windows' : isMac ? 'macos' : 'linux');
	return {
		...defaultSettings.shellPreferences[targetPlatform],
		...(data.shellPreferences?.[targetPlatform] || {})
	};
}

/**
 * Update keyboard shortcuts
 * @param {string} workspaceId - Optional workspace ID
 * @param {Object} shortcuts - Shortcuts to update
 * @returns {Promise<Object>} Updated settings
 */
export async function updateShortcuts(workspaceId = null, shortcuts) {
	const data = get(appSettingsStore);

	const updatedData = {
		...data,
		shortcuts: {
			...(data.shortcuts || defaultSettings.shortcuts),
			...shortcuts
		}
	};

	appSettingsStore.set(updatedData);
	await saveSettings(workspaceId);
	return updatedData;
}

/**
 * Update shell preferences for a specific platform
 * @param {string} workspaceId - Optional workspace ID
 * @param {string} platform - 'windows' | 'macos' | 'linux'
 * @param {Object} preferences - Preferences to update
 * @returns {Promise<Object>} Updated settings
 */
export async function updateShellPreferences(workspaceId = null, platform, preferences) {
	const data = get(appSettingsStore);

	const updatedData = {
		...data,
		shellPreferences: {
			...(data.shellPreferences || defaultSettings.shellPreferences),
			[platform]: {
				...(data.shellPreferences?.[platform] || defaultSettings.shellPreferences[platform]),
				...preferences
			}
		}
	};

	appSettingsStore.set(updatedData);
	await saveSettings(workspaceId);
	return updatedData;
}

/**
 * Get default shell for current platform
 * @param {string} workspaceId - Optional workspace ID
 * @returns {Promise<string|null>} Default shell path
 */
export async function getDefaultShell(workspaceId = null) {
	try {
		// Load settings to ensure we have the latest
		await loadSettings(workspaceId);
		// Use getShellPreferences which merges with defaults
		const platform = isWin ? 'windows' : isMac ? 'macos' : 'linux';
		const prefs = getShellPreferences(platform);
		const defaultShell = prefs.defaultShell || null;
		return defaultShell;
	} catch (error) {
		console.error('Failed to get default shell:', error);
		return null;
	}
}
