import { writable } from 'svelte/store';

/**
 * Modal composable for managing modal state
 * @param {boolean} initialState - Initial open/closed state
 * @returns {Object} Modal state and methods
 */
export function useModal(initialState = false) {
	const isOpen = writable(initialState);
	const data = writable(null);

	return {
		// Store
		isOpen,
		data,

		/**
		 * Open the modal
		 * @param {*} modalData - Optional data to pass to modal
		 */
		open: (modalData = null) => {
			data.set(modalData);
			isOpen.set(true);
		},

		/**
		 * Close the modal
		 */
		close: () => {
			isOpen.set(false);
			// Clear data after animation completes
			setTimeout(() => data.set(null), 300);
		},

		/**
		 * Toggle modal open/closed
		 */
		toggle: () => {
			isOpen.update(v => !v);
		}
	};
}
