import { writable } from 'svelte/store';

/**
 * Panel state for different features/routes
 * @typedef {Object} PanelState
 * @property {boolean} showPanel - Whether panel is open
 * @property {string} panelType - Type of panel ('host' | 'group' | 'key' | etc.)
 * @property {string|null} editingId - ID of item being edited
 */

/**
 * Creates the panel store for managing panel states across routes
 * @returns {Object} Store with subscribe method and action methods
 */
function createPanelStore() {
	const { subscribe, set, update } = writable({
		hosts: {
			showPanel: false,
			panelType: 'host',
			editingId: null
		},
		keychain: {
			showPanel: false,
			panelType: 'key',
			editingId: null
		},
		group: {
			showPanel: false,
			panelType: 'host',
			editingId: null
		}
	});

	return {
		subscribe,

		/**
		 * Get panel state for a feature
		 * @param {string} feature - Feature name ('hosts' | 'keychain' | 'group')
		 * @returns {PanelState} Panel state
		 */
		getPanelState: feature => {
			let state;
			const unsubscribe = subscribe(s => {
				state = s[feature] || { showPanel: false, panelType: null, editingId: null };
			});
			unsubscribe();
			return state;
		},

		/**
		 * Open panel for a feature
		 * @param {string} feature - Feature name
		 * @param {string} panelType - Type of panel
		 * @param {string|null} editingId - ID of item being edited
		 */
		openPanel: (feature, panelType, editingId = null) => {
			update(state => ({
				...state,
				[feature]: {
					showPanel: true,
					panelType,
					editingId
				}
			}));
		},

		/**
		 * Close panel for a feature
		 * @param {string} feature - Feature name
		 */
		closePanel: feature => {
			update(state => ({
				...state,
				[feature]: {
					showPanel: false,
					panelType: state[feature]?.panelType || null,
					editingId: null
				}
			}));
		},

		/**
		 * Update panel state for a feature
		 * @param {string} feature - Feature name
		 * @param {Partial<PanelState>} updates - Partial panel state updates
		 */
		updatePanel: (feature, updates) => {
			update(state => ({
				...state,
				[feature]: {
					...state[feature],
					...updates
				}
			}));
		},

		/**
		 * Reset all panel states
		 */
		reset: () => {
			set({
				hosts: { showPanel: false, panelType: 'host', editingId: null },
				keychain: { showPanel: false, panelType: 'key', editingId: null },
				group: { showPanel: false, panelType: 'host', editingId: null }
			});
		}
	};
}

export const panelStore = createPanelStore();
