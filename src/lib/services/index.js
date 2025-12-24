/**
 * Main barrel export for all services
 * Usage: import { tauriCommands, localStorage, terminalCommands, etc. } from '$lib/services';
 */

export {
	tauriCommands,
	tauriEvents,
	tauriDialog,
	tauriFs,
	terminalCommands,
	terminalEvents
} from './tauri/index.js';
export { localStorage, fileStorage } from './storage/index.js';
export {
	keychainStore,
	loadKeychain,
	saveKeychain,
	addKey,
	updateKey,
	deleteKey,
	getKeys,
	getKeysByVault,
	getVaults,
	isLabelDuplicate,
	isKeyDuplicate,
	findDuplicateKey,
	importKeyFromFile
} from './keychain.js';
export { parseSSHConfig } from './ssh-config.js';
export {
	hostsStore,
	loadHosts,
	saveHosts,
	addHost,
	updateHost,
	deleteHost,
	getHosts,
	getHostsByGroup,
	getHostById,
	isHostLabelDuplicate,
	getGroups,
	addGroup,
	updateGroup,
	deleteGroup,
	getGroupById,
	isGroupNameDuplicate,
	getHostTags
} from './hosts.js';
export {
	snippetsStore,
	loadSnippets,
	saveSnippets,
	addSnippet,
	updateSnippet,
	deleteSnippet,
	getSnippets,
	getSnippetById,
	isSnippetNameDuplicate,
	getSnippetTags,
	incrementSnippetClickCount
} from './snippets.js';
export { connectSSH, retrySSHConnection } from './ssh-connection.js';
export { connectionFactory } from './connection/index.js';
export { loadSyncSettings, saveSyncSettings, clearSyncSettings } from './sync-settings.js';
export {
	appSettingsStore,
	loadSettings,
	saveSettings,
	getAutoReconnectSettings,
	getHeartbeatSettings,
	updateAutoReconnectSettings
} from './app-settings.js';
export { attemptReconnect, cancelReconnect, isReconnecting } from './auto-reconnect.js';
export { connectionHeartbeat } from './connection-heartbeat.js';
export { networkStateMonitor, networkOnline } from './network-state.js';
export { createLocalTerminal } from './terminal-manager.js';
