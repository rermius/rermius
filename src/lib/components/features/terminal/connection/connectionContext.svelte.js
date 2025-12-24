/**
 * Connection Context for Terminal Components
 *
 * Provides shared reactive state for connection-related components
 * using Svelte 5 runes pattern. This eliminates prop drilling and
 * ensures consistent state across ConnectionStatusCard, ConnectionProgressBar,
 * ConnectionLogViewer, and other connection UI components.
 *
 * @example
 * // In parent component (ConnectionStatusCard.svelte)
 * import { createConnectionContext } from './connectionContext.svelte.js';
 *
 * const props = $props();
 * createConnectionContext(
 *   () => props.tab,
 *   () => props.host,
 *   {
 *     onclose: () => props.onclose?.(),
 *     onretry: () => props.onretry?.(),
 *     onedit: () => props.onedit?.()
 *   }
 * );
 *
 * // In child component (ConnectionProgressBar.svelte)
 * import { useConnectionContext } from './connectionContext.svelte.js';
 *
 * const ctx = useConnectionContext();
 * // Access: ctx.connectionState, ctx.host, ctx.actions.close(), etc.
 */

import { setContext, getContext } from 'svelte';
import { getAutoReconnectSettings } from '$lib/services';

const CONNECTION_CTX = Symbol('connection');

/**
 * Creates and provides connection context to child components
 *
 * @param {() => Object} getTab - Getter function for reactive tab object
 * @param {() => Object} getHost - Getter function for reactive host object
 * @param {Object} actions - Action callbacks { onclose, onretry, onedit }
 * @returns {Object} The created context object
 */
export function createConnectionContext(getTab, getHost, actions = {}) {
	const { onclose, onretry, onedit } = actions;

	const ctx = {
		// Reactive getters - these stay in sync with parent's state
		get tab() {
			return getTab();
		},
		get host() {
			return getHost();
		},

		// Derived state
		get connectionState() {
			return this.tab?.connectionState;
		},
		get connectionLogs() {
			return this.tab?.connectionLogs || [];
		},
		get isReconnecting() {
			return this.tab?.isReconnecting || false;
		},
		get autoReconnectRetryCount() {
			return this.tab?.autoReconnectRetryCount || 0;
		},
		get showProgress() {
			const state = this.connectionState;
			return state === 'CONNECTED' || state === 'FAILED';
		},

		// Reconnect settings
		get reconnectSettings() {
			return getAutoReconnectSettings();
		},
		get reconnectMessage() {
			if (this.isReconnecting && this.autoReconnectRetryCount) {
				return `Reconnecting... (attempt ${this.autoReconnectRetryCount}/${this.reconnectSettings.maxRetries})`;
			}
			return null;
		},

		// Host display info
		get hostLabel() {
			return this.host?.label || 'Unknown Host';
		},
		get hostAddress() {
			return `SSH ${this.host?.hostname || 'unknown'}:${this.host?.port || 22}`;
		},
		get hostColor() {
			return this.host?.color || '#4A9FFF';
		},
		get connectionType() {
			return this.host?.connectionType || 'ssh';
		},

		// Actions - bound to parent callbacks
		actions: {
			close() {
				onclose?.();
			},
			retry() {
				onretry?.();
			},
			editHost() {
				onedit?.();
			}
		}
	};

	setContext(CONNECTION_CTX, ctx);
	return ctx;
}

/**
 * Retrieves the connection context from parent component
 * Must be called during component initialization
 *
 * @returns {Object} Connection context object
 * @throws {Error} If called outside of a connection context provider
 */
export function useConnectionContext() {
	const ctx = getContext(CONNECTION_CTX);
	if (!ctx) {
		throw new Error(
			'useConnectionContext must be used within a component that has createConnectionContext'
		);
	}
	return ctx;
}
