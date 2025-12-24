import { writable } from 'svelte/store';

/**
 * Creates the global app store for managing application-wide state
 * @returns {Object} Store with subscribe method and action methods
 */
function createAppStore() {
	const { subscribe, set, update } = writable({
		sidebarOpen: true,
		activeModal: null,
		loading: false
	});

	return {
		subscribe,

		/**
		 * Toggle sidebar open/closed state
		 */
		toggleSidebar: () =>
			update(state => ({
				...state,
				sidebarOpen: !state.sidebarOpen
			})),

		/**
		 * Set sidebar state explicitly
		 * @param {boolean} open - Whether sidebar should be open
		 */
		setSidebar: open =>
			update(state => ({
				...state,
				sidebarOpen: open
			})),

		/**
		 * Open a modal by name
		 * @param {string} modalName - Name/ID of the modal to open
		 */
		openModal: modalName =>
			update(state => ({
				...state,
				activeModal: modalName
			})),

		/**
		 * Close the currently active modal
		 */
		closeModal: () =>
			update(state => ({
				...state,
				activeModal: null
			})),

		/**
		 * Set global loading state
		 * @param {boolean} loading - Whether app is loading
		 */
		setLoading: loading =>
			update(state => ({
				...state,
				loading
			})),

		/**
		 * Reset store to initial state
		 */
		reset: () =>
			set({
				sidebarOpen: true,
				activeModal: null,
				loading: false
			})
	};
}

export const appStore = createAppStore();
