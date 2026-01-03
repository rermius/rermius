/**
 * Data Services
 * User data management: workspaces, hosts, keychain, snippets, and app settings
 */

// Workspace management
export {
	setWorkspacesStore,
	getWorkspaceDataPath,
	getWorkspaceAvatarPath,
	loadWorkspaces,
	saveWorkspaces,
	addWorkspace,
	updateWorkspace,
	deleteWorkspace,
	getWorkspaces,
	getWorkspaceById,
	getCurrentWorkspaceId,
	setCurrentWorkspace,
	isWorkspaceNameDuplicate,
	createWorkspaceDirectory,
	deleteWorkspaceDirectory,
	saveWorkspaceAvatar,
	deleteWorkspaceAvatar,
	isFirstLaunch,
	createDefaultWorkspace,
	switchWorkspace,
	getWorkspaceInitials
} from './workspaces.js';

// Keychain (SSH keys)
export {
	keychainStore,
	loadKeychain,
	saveKeychain,
	addKey,
	updateKey,
	deleteKey,
	exportKey,
	getKeys,
	getKeysByVault,
	getVaults,
	isLabelDuplicate,
	isKeyDuplicate,
	findDuplicateKey,
	importKeyFromFile
} from './keychain.js';

// Hosts and groups
export {
	hostsStore,
	loadHosts,
	saveHosts,
	addHost,
	updateHost,
	deleteHost,
	duplicateHost,
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

// Snippets
export {
	snippetsStore,
	loadSnippets,
	saveSnippets,
	addSnippet,
	updateSnippet,
	deleteSnippet,
	duplicateSnippet,
	getSnippets,
	getSnippetById,
	isSnippetNameDuplicate,
	getSnippetTags,
	incrementSnippetClickCount
} from './snippets.js';

// Application settings
export {
	appSettingsStore,
	loadSettings,
	saveSettings,
	getAutoReconnectSettings,
	getHeartbeatSettings,
	updateAutoReconnectSettings,
	getUiSettings,
	updateUiSettings,
	getShortcuts,
	getShellPreferences,
	updateShortcuts,
	updateShellPreferences,
	getDefaultShell
} from './app-settings.js';
