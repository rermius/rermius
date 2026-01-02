import { toastStore } from '$lib/stores/toast.store.js';

/**
 * Toast composable - simplified access to toast notifications
 * @returns {Object} Toast methods
 */
export function useToast() {
	return {
		/**
		 * Show a toast notification
		 * @param {string} message - Message to display
		 * @param {'info' | 'success' | 'error' | 'warning'} type - Toast type
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		show: (message, type = 'info', duration = 3000) => {
			return toastStore.show(message, type, duration);
		},

		/**
		 * Show success toast
		 * @param {string} message - Success message
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		success: (message, duration = 3000) => {
			return toastStore.success(message, duration);
		},

		/**
		 * Show error toast
		 * @param {string} message - Error message
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		error: (message, duration = 5000) => {
			return toastStore.error(message, duration);
		},

		/**
		 * Show warning toast
		 * @param {string} message - Warning message
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		warning: (message, duration = 4000) => {
			return toastStore.warning(message, duration);
		},

		/**
		 * Show info toast
		 * @param {string} message - Info message
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		info: (message, duration = 3000) => {
			return toastStore.info(message, duration);
		},

		/**
		 * Show success toast with action button
		 * @param {string} message - Success message
		 * @param {Object} action - Action config {label: string, onClick: function}
		 * @param {number} duration - Duration in ms
		 * @returns {number} Toast ID
		 */
		successWithAction: (message, action, duration = 8000) => {
			return toastStore.successWithAction(message, action, duration);
		},

		/**
		 * Dismiss a toast by ID
		 * @param {number} id - Toast ID
		 */
		dismiss: id => {
			toastStore.dismiss(id);
		},

		/**
		 * Dismiss all toasts
		 */
		dismissAll: () => {
			toastStore.dismissAll();
		}
	};
}
