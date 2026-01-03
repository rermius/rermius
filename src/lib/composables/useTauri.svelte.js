import { onMount, onDestroy } from 'svelte';
import { tauriCommands, tauriEvents } from '$lib/services';

/**
 * Tauri composable for easy access to Tauri commands and events
 * Automatically handles event listener cleanup
 * @returns {Object} Tauri commands and event helpers
 */
export function useTauri() {
	const eventListeners = [];

	/**
	 * Register an event listener with automatic cleanup
	 * @param {string} eventName - Event name to listen for
	 * @param {Function} callback - Callback function
	 * @returns {Promise<Function>} Unlisten function
	 */
	async function addEventListener(eventName, callback) {
		try {
			let unlisten;

			if (eventName === 'ssh-connected') {
				unlisten = await tauriEvents.onSSHConnect(callback);
			} else if (eventName === 'ssh-disconnected') {
				unlisten = await tauriEvents.onSSHDisconnect(callback);
			} else if (eventName === 'error') {
				unlisten = await tauriEvents.onError(callback);
			} else {
				unlisten = await tauriEvents.on(eventName, callback);
			}

			// Store for cleanup
			if (unlisten) {
				eventListeners.push(unlisten);
			}

			return unlisten;
		} catch (error) {
			console.error(`Failed to add event listener for ${eventName}:`, error);
			return () => {};
		}
	}

	/**
	 * Remove all event listeners
	 */
	function removeAllListeners() {
		eventListeners.forEach(unlisten => {
			if (typeof unlisten === 'function') {
				unlisten();
			}
		});
		eventListeners.length = 0;
	}

	// Cleanup on component unmount
	onDestroy(() => {
		removeAllListeners();
	});

	return {
		// Tauri commands
		commands: tauriCommands,

		// Event handling
		addEventListener,
		removeAllListeners,

		// Convenience methods for common events
		onSSHConnect: callback => addEventListener('ssh-connected', callback),
		onSSHDisconnect: callback => addEventListener('ssh-disconnected', callback),
		onError: callback => addEventListener('error', callback)
	};
}
