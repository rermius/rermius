/**
 * LocalStorage and storage key constants
 * Centralize all storage keys to avoid typos and conflicts
 */

export const STORAGE_KEYS = {
	// Theme
	THEME: 'app-theme',
	THEME_MODE: 'app-theme-mode',

	// UI State
	SIDEBAR_STATE: 'sidebar-open',
	SIDEBAR_WIDTH: 'sidebar-width',
	WINDOW_SIZE: 'window-size',

	// User Preferences
	USER_PREFERENCES: 'user-preferences',
	RECENT_HOSTS: 'recent-hosts',
	FAVORITE_HOSTS: 'favorite-hosts',
	LAST_CONNECTED_HOST: 'last-connected-host',

	// Editor Settings
	EDITOR_FONT_SIZE: 'editor-font-size',
	EDITOR_THEME: 'editor-theme',
	EDITOR_LINE_WRAP: 'editor-line-wrap',

	// SSH Settings
	SSH_DEFAULT_PORT: 'ssh-default-port',
	SSH_DEFAULT_USER: 'ssh-default-user',
	SSH_TIMEOUT: 'ssh-timeout',

	// View Settings
	VIEW_MODE: 'view-mode', // 'grid' | 'list'
	SORT_BY: 'sort-by',
	SORT_ORDER: 'sort-order', // 'asc' | 'desc'

	// Logs
	LOG_LEVEL: 'log-level',
	LOG_RETENTION: 'log-retention-days',

	// Workspaces
	CURRENT_WORKSPACE_ID: 'current-workspace-id',
	WORKSPACE_FIRST_LAUNCH: 'workspace-first-launch-completed'
};

/**
 * File storage paths (relative to app config dir)
 */
export const FILE_PATHS = {
	HOSTS: 'hosts.json',
	KEYCHAIN: 'keychain.json',
	PORT_FORWARDING: 'port-forwarding.json',
	SNIPPETS: 'snippets.json',
	KNOWN_HOSTS: 'known-hosts.json',
	LOGS: 'logs.json',
	SETTINGS: 'settings.json',

	// Workspaces
	WORKSPACES: 'workspaces.json',
	WORKSPACE_AVATARS_DIR: 'workspace-avatars',
	WORKSPACES_DATA_DIR: 'workspaces'
};
