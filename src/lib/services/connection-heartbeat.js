/**
 * Connection Heartbeat Service
 * Detects zombie connections by sending periodic pings
 *
 * Features:
 * - Periodic ping to verify connection is alive
 * - Detects stale/zombie connections
 * - Triggers reconnect when ping fails
 * - Configurable interval and timeout
 */

import { terminalCommands } from './tauri/index.js';
import { get } from 'svelte/store';
import { tabsStore } from '$lib/stores';
import { attemptReconnect } from './auto-reconnect.js';

/**
 * Heartbeat Manager Class
 */
class ConnectionHeartbeatManager {
	constructor() {
		// Map of sessionId -> heartbeat state
		this.heartbeats = new Map();

		// Default settings (can be overridden)
		this.defaultInterval = 30000; // 30 seconds
		this.defaultTimeout = 10000; // 10 seconds
		this.maxConsecutiveFailures = 2; // Fail after 2 misses
	}

	/**
	 * Start heartbeat for a session
	 * @param {string} sessionId - Terminal session ID
	 * @param {string} tabId - Tab ID for triggering reconnect
	 * @param {Object} options - Heartbeat options
	 * @param {number} [options.interval] - Ping interval in ms
	 * @param {number} [options.timeout] - Ping timeout in ms
	 * @param {number} [options.maxFailures] - Max consecutive failures before triggering reconnect
	 */
	start(sessionId, tabId, options = {}) {
		// Don't start if already running
		if (this.heartbeats.has(sessionId)) {
			console.warn('[heartbeat] Already running for session:', sessionId);
			return;
		}

		const interval = options.interval || this.defaultInterval;
		const timeout = options.timeout || this.defaultTimeout;
		const maxFailures = options.maxFailures || this.maxConsecutiveFailures;

		const state = {
			sessionId,
			tabId,
			interval,
			timeout,
			maxFailures,
			consecutiveFailures: 0,
			lastPingTime: Date.now(),
			lastPongTime: Date.now(),
			isRunning: true,
			timerId: null
		};

		this.heartbeats.set(sessionId, state);

		console.log(
			`[heartbeat] Started for session: ${sessionId}, interval: ${interval}ms, tabId: ${tabId}`
		);

		// Start ping loop
		this.schedulePing(state);
	}

	/**
	 * Schedule next ping
	 * @param {Object} state - Heartbeat state
	 */
	schedulePing(state) {
		if (!state.isRunning) return;

		state.timerId = setTimeout(() => {
			this.sendPing(state);
		}, state.interval);
	}

	/**
	 * Send ping to session
	 * @param {Object} state - Heartbeat state
	 */
	async sendPing(state) {
		if (!state.isRunning) return;

		const { sessionId, tabId, timeout, maxFailures } = state;

		state.lastPingTime = Date.now();

		try {
			// Send ping command with timeout
			const pingPromise = terminalCommands.ping(sessionId);
			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Ping timeout')), timeout)
			);

			await Promise.race([pingPromise, timeoutPromise]);

			// SUCCESS - reset failure counter
			state.lastPongTime = Date.now();
			state.consecutiveFailures = 0;

			console.log(`[heartbeat] Ping OK for session: ${sessionId}`);

			// Schedule next ping
			this.schedulePing(state);
		} catch (error) {
			// FAILURE - increment counter
			state.consecutiveFailures++;

			console.warn(
				`[heartbeat] Ping failed for session: ${sessionId}, failures: ${state.consecutiveFailures}/${maxFailures}`,
				error.message
			);

			if (state.consecutiveFailures >= maxFailures) {
				// Connection is dead - trigger reconnect
				console.error(
					`[heartbeat] Connection appears dead for session: ${sessionId}, triggering reconnect`
				);

				this.stop(sessionId);
				this.handleConnectionDead(tabId);
			} else {
				// Schedule retry
				this.schedulePing(state);
			}
		}
	}

	/**
	 * Handle dead connection detected
	 * @param {string} tabId - Tab ID
	 */
	async handleConnectionDead(tabId) {
		// Verify tab still exists
		const tabs = get(tabsStore);
		const tab = tabs.tabs.find(t => t.id === tabId);

		if (!tab) {
			console.warn('[heartbeat] Tab not found for dead connection:', tabId);
			return;
		}

		// Update tab to FAILED state
		tabsStore.updateTabConnectionState(tabId, {
			connectionState: 'FAILED',
			connectionError: 'Connection lost (heartbeat timeout)',
			connectionLogs: [
				...(tab.connectionLogs || []),
				'Connection heartbeat failed - connection appears dead'
			]
		});

		// Trigger auto-reconnect
		console.log('[heartbeat] Triggering auto-reconnect for tab:', tabId);
		await attemptReconnect(tabId);
	}

	/**
	 * Stop heartbeat for a session
	 * @param {string} sessionId - Terminal session ID
	 */
	stop(sessionId) {
		const state = this.heartbeats.get(sessionId);
		if (!state) {
			return;
		}

		console.log('[heartbeat] Stopped for session:', sessionId);

		// Stop timer
		if (state.timerId) {
			clearTimeout(state.timerId);
			state.timerId = null;
		}

		state.isRunning = false;
		this.heartbeats.delete(sessionId);
	}

	/**
	 * Stop all heartbeats
	 */
	stopAll() {
		console.log('[heartbeat] Stopping all heartbeats');
		for (const sessionId of this.heartbeats.keys()) {
			this.stop(sessionId);
		}
	}

	/**
	 * Get heartbeat state for a session
	 * @param {string} sessionId - Terminal session ID
	 * @returns {Object|null} Heartbeat state or null
	 */
	getState(sessionId) {
		return this.heartbeats.get(sessionId) || null;
	}

	/**
	 * Check if heartbeat is running for a session
	 * @param {string} sessionId - Terminal session ID
	 * @returns {boolean}
	 */
	isRunning(sessionId) {
		const state = this.heartbeats.get(sessionId);
		return state ? state.isRunning : false;
	}
}

// Singleton instance
export const connectionHeartbeat = new ConnectionHeartbeatManager();
