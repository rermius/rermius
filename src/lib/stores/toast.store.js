import { writable } from 'svelte/store';

/**
 * @typedef {Object} Toast
 * @property {number} id - Unique identifier for the toast
 * @property {string} message - Toast message to display
 * @property {'info' | 'success' | 'error' | 'warning'} type - Toast type
 * @property {number} duration - How long to show toast (ms), 0 for permanent
 */

/**
 * Creates the toast notification store
 * @returns {Object} Store with subscribe method and toast actions
 */
function createToastStore() {
	const { subscribe, update } = writable([]);

	return {
		subscribe,

		/**
		 * Show a toast notification
		 * @param {string} message - Message to display
		 * @param {'info' | 'success' | 'error' | 'warning'} type - Toast type
		 * @param {number} duration - Duration in ms (0 for permanent)
		 * @returns {number} Toast ID
		 */
		show(message, type = 'info', duration = 3000) {
			const id = Date.now() + Math.random();

			update(toasts => [...toasts, { id, message, type, duration }]);

			// Auto-dismiss if duration is set
			if (duration > 0) {
				setTimeout(() => this.dismiss(id), duration);
			}

			return id;
		},

		/**
		 * Show a success toast
		 * @param {string} message - Success message
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		success(message, duration = 3000) {
			return this.show(message, 'success', duration);
		},

		/**
		 * Show an error toast
		 * @param {string} message - Error message
		 * @param {number} duration - Duration in ms (default longer for errors)
		 * @returns {number} Toast ID
		 */
		error(message, duration = 5000) {
			return this.show(message, 'error', duration);
		},

		/**
		 * Show a warning toast
		 * @param {string} message - Warning message
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		warning(message, duration = 4000) {
			return this.show(message, 'warning', duration);
		},

		/**
		 * Show an info toast
		 * @param {string} message - Info message
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		info(message, duration = 3000) {
			return this.show(message, 'info', duration);
		},

		/**
		 * Dismiss a toast by ID
		 * @param {number} id - Toast ID to dismiss
		 */
		dismiss(id) {
			update(toasts => toasts.filter(t => t.id !== id));
		},

		/**
		 * Dismiss all toasts
		 */
		dismissAll() {
			update(() => []);
		}
	};
}

export const toastStore = createToastStore();
