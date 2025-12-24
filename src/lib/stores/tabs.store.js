import { writable } from 'svelte/store';
import { generateUniqueTabLabel } from '$lib/utils/filename-utils';

/**
 * Tab types
 * @typedef {'home' | 'terminal' | 'file-browser'} TabType
 */

/**
 * Connection states for SSH tabs
 * @typedef {'IDLE' | 'CONNECTING' | 'CONNECTED' | 'FAILED'} ConnectionState
 */

/**
 * Tab object
 * @typedef {Object} Tab
 * @property {string} id - Unique tab ID
 * @property {TabType} type - Tab type
 * @property {string} label - Tab display label
 * @property {boolean} closeable - Whether tab can be closed
 * @property {string} [icon] - Optional icon name
 * @property {string} [sessionId] - Terminal session ID (for terminal tabs)
 * @property {ConnectionState} [connectionState] - SSH connection state
 * @property {string} [hostId] - Host ID for SSH connections
 * @property {string[]} [connectionLogs] - Connection logs for debugging
 * @property {string} [connectionError] - Error message if connection failed
 * @property {boolean} [showEditPanel] - Whether to show edit host panel
 * @property {boolean} [showFileManager] - Whether to show remote file manager split
 * @property {string|null} [fileSessionId] - Remote file-transfer session for split view
 */

/**
 * Create tabs store
 * Manages all application tabs (Home, Terminal sessions, etc.)
 */
function createTabsStore() {
	const { subscribe, set, update } = writable({
		tabs: [
			{
				id: 'home',
				type: 'home',
				label: 'Home',
				closeable: false,
				icon: 'house-filled'
			}
		],
		activeTabId: 'home'
	});

	return {
		subscribe,

		/**
		 * Set active tab
		 * @param {string} tabId
		 */
		setActiveTab: tabId => {
			update(state => ({ ...state, activeTabId: tabId }));
		},

		/**
		 * Set tabs array (used for drag & drop reordering)
		 * @param {Tab[]} tabs
		 */
		setTabs: tabs => {
			update(state => ({ ...state, tabs }));
		},

		/**
		 * Add a new terminal tab
		 * @param {string} sessionId - Terminal session ID
		 * @param {string} [label] - Tab label
		 * @param {boolean} [isLocal=false] - Whether this is a local terminal (vs SSH)
		 */
		addTerminalTab: (sessionId, label = 'Terminal', isLocal = false) => {
			update(state => {
				const newTab = {
					id: `terminal-${sessionId}`,
					type: 'terminal',
					label,
					closeable: true,
					sessionId,
					isLocal
				};

				return {
					tabs: [...state.tabs, newTab],
					activeTabId: newTab.id
				};
			});
		},

		/**
		 * Remove a tab
		 * @param {string} tabId
		 */
		removeTab: tabId => {
			console.warn('[tabs.store] removeTab', { tabId });
			update(state => {
				const newTabs = state.tabs.filter(t => t.id !== tabId);
				let newActiveId = state.activeTabId;

				// If removing active tab, switch to previous tab or home
				if (state.activeTabId === tabId) {
					const removedIndex = state.tabs.findIndex(t => t.id === tabId);
					if (removedIndex > 0) {
						newActiveId = newTabs[removedIndex - 1].id;
					} else if (newTabs.length > 0) {
						newActiveId = newTabs[0].id;
					}
				}

				return {
					tabs: newTabs,
					activeTabId: newActiveId
				};
			});
		},

		/**
		 * Update tab label
		 * @param {string} tabId
		 * @param {string} label
		 */
		updateTabLabel: (tabId, label) => {
			update(state => ({
				...state,
				tabs: state.tabs.map(tab => (tab.id === tabId ? { ...tab, label } : tab))
			}));
		},

		/**
		 * Reorder tabs by moving one tab to another position
		 * @param {string} draggedTabId - ID of the tab being dragged
		 * @param {string} targetTabId - ID of the tab being dropped onto
		 */
		reorderTabs: (draggedTabId, targetTabId) => {
			update(state => {
				const draggedIndex = state.tabs.findIndex(t => t.id === draggedTabId);
				const targetIndex = state.tabs.findIndex(t => t.id === targetTabId);

				if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
					return state;
				}

				const newTabs = [...state.tabs];
				const [draggedTab] = newTabs.splice(draggedIndex, 1);
				newTabs.splice(targetIndex, 0, draggedTab);

				return {
					...state,
					tabs: newTabs
				};
			});
		},

		/**
		 * Add a new SSH connection tab with loading state
		 * @param {Object} options - Tab options
		 * @param {string} options.hostId - Host ID
		 * @param {string} options.baseLabel - Base label for tab (will be made unique)
		 * @returns {string} The new tab ID
		 */
		addSSHTab: ({ hostId, baseLabel }) => {
			let newTabId;
			update(state => {
				// Generate unique label
				const uniqueLabel = generateUniqueTabLabel(baseLabel, state.tabs);

				// Create new tab with CONNECTING state
				newTabId = `terminal-${crypto.randomUUID()}`;
				const newTab = {
					id: newTabId,
					type: 'terminal',
					label: uniqueLabel,
					closeable: true,
					hostId,
					connectionState: 'CONNECTING',
					connectionLogs: [],
					sessionId: null,
					showFileManager: false,
					fileSessionId: null,
					// Auto-reconnect state
					autoReconnectRetryCount: 0,
					isReconnecting: false,
					reconnectCancelled: false
				};

				return {
					tabs: [...state.tabs, newTab],
					activeTabId: newTab.id
				};
			});
			return newTabId;
		},

		/**
		 * Update tab connection state
		 * @param {string} tabId - Tab ID
		 * @param {Object} updates - State updates
		 * @param {ConnectionState} [updates.connectionState] - New connection state
		 * @param {string} [updates.sessionId] - Terminal session ID (when connected)
		 * @param {string[]} [updates.connectionLogs] - Connection logs
		 * @param {string} [updates.connectionError] - Error message
		 */
		updateTabConnectionState: (tabId, updates) => {
			update(state => ({
				...state,
				tabs: state.tabs.map(tab =>
					tab.id === tabId
						? {
								...tab,
								...updates
							}
						: tab
				)
			}));
		},

		/**
		 * Add a new file browser tab for FTP/FTPS connections
		 * @param {Object} options - Tab options
		 * @param {string} options.hostId - Host ID
		 * @param {string} options.baseLabel - Base label for tab
		 * @param {string} options.connectionType - Connection type (ftp/ftps)
		 * @returns {string} The new tab ID
		 */
		addFileBrowserTab: ({ hostId, baseLabel, connectionType }) => {
			let newTabId;
			update(state => {
				const uniqueLabel = generateUniqueTabLabel(baseLabel, state.tabs);

				newTabId = `file-browser-${crypto.randomUUID()}`;
				const newTab = {
					id: newTabId,
					type: 'file-browser',
					label: uniqueLabel,
					closeable: true,
					icon: 'folder',
					hostId,
					connectionType,
					connectionState: 'CONNECTING',
					connectionLogs: [],
					sessionId: null,
					// Auto-reconnect state
					autoReconnectRetryCount: 0,
					isReconnecting: false,
					reconnectCancelled: false
				};

				return {
					tabs: [...state.tabs, newTab],
					activeTabId: newTab.id
				};
			});
			return newTabId;
		},

		/**
		 * Update tab reconnect state
		 * @param {string} tabId - Tab ID
		 * @param {Object} updates - Reconnect state updates
		 * @param {number} [updates.autoReconnectRetryCount] - Current retry count
		 * @param {boolean} [updates.isReconnecting] - Whether reconnect is in progress
		 * @param {boolean} [updates.reconnectCancelled] - Whether user cancelled reconnect
		 */
		updateTabReconnectState: (tabId, updates) => {
			update(state => ({
				...state,
				tabs: state.tabs.map(tab =>
					tab.id === tabId
						? {
								...tab,
								...updates
							}
						: tab
				)
			}));
		},

		/**
		 * Reset tab reconnect state (called on successful connection)
		 * @param {string} tabId - Tab ID
		 */
		resetTabReconnectState: tabId => {
			update(state => ({
				...state,
				tabs: state.tabs.map(tab =>
					tab.id === tabId
						? {
								...tab,
								autoReconnectRetryCount: 0,
								isReconnecting: false,
								reconnectCancelled: false
							}
						: tab
				)
			}));
		},

		/**
		 * Store host configuration in tab for reconnection
		 * @param {string} tabId - Tab ID
		 * @param {Object} hostConfig - Full host configuration object
		 */
		setTabHostConfig: (tabId, hostConfig) => {
			update(state => ({
				...state,
				tabs: state.tabs.map(tab =>
					tab.id === tabId
						? {
								...tab,
								hostConfig
							}
						: tab
				)
			}));
		},

		/**
		 * Cancel auto-reconnect for a tab
		 * @param {string} tabId - Tab ID
		 */
		cancelTabReconnect: tabId => {
			update(state => ({
				...state,
				tabs: state.tabs.map(tab =>
					tab.id === tabId
						? {
								...tab,
								reconnectCancelled: true,
								isReconnecting: false
							}
						: tab
				)
			}));
		}
	};
}

export const tabsStore = createTabsStore();
