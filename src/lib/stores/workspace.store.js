import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Workspace Store
 * Manages workspace state, current workspace, and loading states
 */
function createWorkspaceStore() {
	const initialState = {
		workspaces: [],
		currentWorkspaceId: null,
		isLoading: false,
		isSwitching: false
	};

	const { subscribe, set, update } = writable(initialState);

	return {
		subscribe,

		/**
		 * Set all workspaces
		 * @param {Array<Object>} workspaces - Array of workspace objects
		 */
		setWorkspaces: workspaces => {
			update(state => ({
				...state,
				workspaces
			}));
		},

		/**
		 * Set current workspace ID
		 * @param {string} workspaceId - Workspace ID to set as current
		 */
		setCurrentWorkspace: workspaceId => {
			update(state => ({
				...state,
				currentWorkspaceId: workspaceId
			}));

			// Sync to localStorage for quick access
			if (browser) {
				localStorage.setItem('current-workspace-id', workspaceId);
			}
		},

		/**
		 * Add a new workspace
		 * @param {Object} workspace - Workspace object to add
		 */
		addWorkspace: workspace => {
			update(state => ({
				...state,
				workspaces: [...state.workspaces, workspace]
			}));
		},

		/**
		 * Update an existing workspace
		 * @param {string} workspaceId - Workspace ID to update
		 * @param {Object} updatedWorkspace - Updated workspace object
		 */
		updateWorkspace: (workspaceId, updatedWorkspace) => {
			update(state => ({
				...state,
				workspaces: state.workspaces.map(w => (w.id === workspaceId ? updatedWorkspace : w))
			}));
		},

		/**
		 * Remove a workspace
		 * @param {string} workspaceId - Workspace ID to remove
		 */
		removeWorkspace: workspaceId => {
			update(state => ({
				...state,
				workspaces: state.workspaces.filter(w => w.id !== workspaceId)
			}));
		},

		/**
		 * Set loading state
		 * @param {boolean} isLoading - Loading state
		 */
		setLoading: isLoading => {
			update(state => ({
				...state,
				isLoading
			}));
		},

		/**
		 * Set switching state
		 * @param {boolean} isSwitching - Switching animation state
		 */
		setSwitching: isSwitching => {
			update(state => ({
				...state,
				isSwitching
			}));
		},

		/**
		 * Reset store to initial state
		 */
		reset: () => {
			set(initialState);
			if (browser) {
				localStorage.removeItem('current-workspace-id');
			}
		}
	};
}

export const workspaceStore = createWorkspaceStore();
