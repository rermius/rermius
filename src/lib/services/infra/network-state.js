/**
 * Network State Monitor
 * Tracks online/offline network status for better reconnect logic
 *
 * Features:
 * - Detects network connectivity changes
 * - Provides async waiting for network restoration
 * - Prevents wasteful reconnect attempts when offline
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Network state store
 * @type {import('svelte/store').Writable<boolean>}
 */
export const networkOnline = writable(browser ? navigator.onLine : true);

/**
 * Network State Monitor Class
 */
class NetworkStateMonitor {
	constructor() {
		this.onlineListeners = new Set();
		this.offlineListeners = new Set();
		this.initialized = false;

		if (browser) {
			this.init();
		}
	}

	/**
	 * Initialize network event listeners
	 */
	init() {
		if (this.initialized) return;

		// Listen for online/offline events
		window.addEventListener('online', this.handleOnline.bind(this));
		window.addEventListener('offline', this.handleOffline.bind(this));

		// Set initial state
		networkOnline.set(navigator.onLine);

		this.initialized = true;
	}

	/**
	 * Handle online event
	 */
	handleOnline() {
		networkOnline.set(true);

		// Notify all waiting listeners
		this.onlineListeners.forEach(resolve => resolve(true));
		this.onlineListeners.clear();
	}

	/**
	 * Handle offline event
	 */
	handleOffline() {
		networkOnline.set(false);
	}

	/**
	 * Check if currently online
	 * @returns {boolean}
	 */
	isOnline() {
		if (!browser) return true;
		return get(networkOnline);
	}

	/**
	 * Wait for network to come back online
	 * @param {number} timeout - Maximum wait time in milliseconds
	 * @returns {Promise<boolean>} True if online, false if timeout
	 */
	waitForOnline(timeout = 30000) {
		// Already online
		if (this.isOnline()) {
			return Promise.resolve(true);
		}

		return new Promise(resolve => {
			// Create timeout timer
			const timeoutId = setTimeout(() => {
				this.onlineListeners.delete(resolve);
				resolve(false); // Timeout reached
			}, timeout);

			// Create resolver that clears timeout
			const wrappedResolve = value => {
				clearTimeout(timeoutId);
				resolve(value);
			};

			// Add to listeners
			this.onlineListeners.add(wrappedResolve);
		});
	}

	/**
	 * Subscribe to network state changes
	 * @param {Function} callback - Called with (isOnline) when state changes
	 * @returns {Function} Unsubscribe function
	 */
	subscribe(callback) {
		return networkOnline.subscribe(callback);
	}

	/**
	 * Cleanup (for testing or teardown)
	 */
	destroy() {
		if (!browser) return;

		window.removeEventListener('online', this.handleOnline);
		window.removeEventListener('offline', this.handleOffline);

		this.onlineListeners.clear();
		this.offlineListeners.clear();
		this.initialized = false;
	}
}

// Singleton instance
export const networkStateMonitor = new NetworkStateMonitor();
