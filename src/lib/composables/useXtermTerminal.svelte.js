/**
 * Unified xterm.js Terminal Composable (Refactored)
 * Single composable for all terminal types (local, SSH, telnet)
 * Uses extracted utilities to eliminate code duplication
 *
 * @param {Object} config - Terminal configuration
 * @param {string} [config.shell] - Shell path (local mode)
 * @param {string} [config.title] - Terminal title
 * @param {string} [config.sessionId] - Existing session ID (for SSH/telnet)
 * @param {string} [config.sessionType] - Session type override: 'local' | 'ssh' | 'telnet'
 * @param {string} [config.homeDirectory] - Home directory for cd command (SSH mode)
 * @param {string} [config.hostId] - Host ID (for SSH sessions, used for theme/font)
 * @returns {Object} Terminal interface
 */

import { onDestroy } from 'svelte';
import { get } from 'svelte/store';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
	terminalCommands,
	terminalEvents,
	getHeartbeatSettings,
	connectionHeartbeat,
	keyboardShortcutManager,
	getDefaultShell
} from '$lib/services';
import { terminalStore, tabsStore, workspaceStore } from '$lib/stores';
import { useToast } from './useToast.svelte.js';
import { defaultFontFamily, defaultFontSize } from '$lib/constants/terminal-fonts';
import { getThemeById } from '$lib/constants/terminal-themes';

// Import utilities from utils/terminal
import {
	loadTerminalTheme,
	loadTerminalFont,
	setupOutputListener,
	setupErrorListener,
	setupUserInput,
	setupResizeObserver,
	setupIMEInterception,
	getThemeFromCSS
} from '$lib/utils/terminal/theme-and-events';

import { setupExitListener } from '$lib/utils/terminal/exit-handlers';

export function useXtermTerminal(config = {}) {
	const {
		shell = null,
		title = 'Terminal',
		sessionId: existingSessionId = null,
		sessionType: explicitSessionType = null,
		homeDirectory = null,
		hostId = null
	} = config;

	const toast = useToast();
	const eventListeners = [];

	// Terminal state
	let terminal = null;  // Don't use $state for object references
	let fitAddon = null;
	let sessionId = $state(existingSessionId);
	let sessionType = $state(explicitSessionType || (existingSessionId ? null : 'local'));
	let resizeObserver = null;
	let onDataDisposable = null;

	// Shared state for utility functions
	const sharedState = {
		isClosing: false,
		isHandlingIME: false
	};

	/**
	 * Initialize terminal session
	 * Works for all session types (local, SSH, telnet)
	 *
	 * @param {HTMLElement} container - DOM element to mount terminal
	 * @param {Object} options - Additional xterm.js options
	 */
	async function initialize(container, options = {}) {
		try {
			// Determine session type if not explicitly provided
			if (!sessionType && existingSessionId) {
				// Query session type from store (for existing sessions)
				const sessions = get(terminalStore).sessions;
				const existingSession = sessions.find(s => s.id === existingSessionId);
				if (existingSession) {
					sessionType = existingSession.type;
				} else {
					// Default to SSH for existing session IDs (backend-created sessions)
					sessionType = 'ssh';
				}
			}

			// Load theme colors
			const themeColors = loadTerminalTheme(sessionType, hostId, getThemeFromCSS);
			const finalTheme = themeColors || getThemeFromCSS();

			// Load font configuration
			const fontConfig = loadTerminalFont(sessionType, hostId);
			const fontSize = fontConfig.fontSize || defaultFontSize;
			const fontFamily = fontConfig.fontFamily || defaultFontFamily;

			// Create xterm.js instance
			terminal = new Terminal({
				cursorBlink: true,
				fontSize,
				fontFamily,
				theme: finalTheme,
				...options
			});

			// Setup fit addon
			fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);

			// Mount terminal
			terminal.open(container);
			fitAddon.fit();

			// Intercept keyboard events for app shortcuts
			terminal.attachCustomKeyEventHandler(event => {
				const isAppShortcut = keyboardShortcutManager.isAppShortcut(event);
				if (isAppShortcut) {
					return false; // Block terminal, let global handler work
				}
				return true; // Let terminal process normally
			});

			// Setup IME interception for CJK languages
			setupIMEInterception(container, sessionId, sharedState, terminal);

			// Session-specific initialization
			if (sessionType === 'local') {
				await initializeLocalSession();
			} else if (sessionType === 'ssh') {
				await initializeSSHSession();
			} else if (sessionType === 'telnet') {
				await initializeTelnetSession();
			}

			// Setup resize observer (common for all types)
			resizeObserver = setupResizeObserver(
				container,
				fitAddon,
				terminal,
				sessionId,
				sharedState
			);

			return sessionId;
		} catch (error) {
			console.error('[useXtermTerminal] Failed to initialize:', error);
			toast.show({
				message: `Failed to create terminal: ${error.message}`,
				type: 'error'
			});
			throw error;
		}
	}

	/**
	 * Initialize local terminal session
	 * Creates new PTY session via backend
	 */
	async function initializeLocalSession() {
		// Get preferred shell
		let preferredShell = shell;
		if (!preferredShell) {
			try {
				const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
				preferredShell = await getDefaultShell(workspaceId);
			} catch (error) {
				console.error('[useXtermTerminal] Failed to get shell preference:', error);
			}
		}

		// Create backend session
		if (!sessionId) {
			const { cols, rows } = terminal;
			sessionId = await terminalCommands.createTerminal({
				shell: preferredShell,
				cols,
				rows
			});
		}

		// Setup event listeners (using extracted utilities)
		const outputUnlisten = await setupOutputListener(sessionId, terminal);
		eventListeners.push(outputUnlisten);

		const exitUnlisten = await setupExitListener(sessionId, 'local', terminalEvents);
		eventListeners.push(exitUnlisten);

		const errorUnlisten = await setupErrorListener(sessionId, error => {
			toast.show({
				message: `Terminal error: ${error}`,
				type: 'error'
			});
		});
		eventListeners.push(errorUnlisten);

		// Setup user input (using extracted utility)
		onDataDisposable = setupUserInput(terminal, sessionId, sharedState);

		// Register or update session in store
		// Check if session already exists (created by terminal-manager)
		const sessions = get(terminalStore).sessions;
		const existingSession = sessions.find(s => s.id === sessionId);

		if (existingSession) {
			// Update existing session with xterm instance and other properties
			terminalStore.updateSession(sessionId, {
				xterm: terminal,
				fitAddon: fitAddon,
				cleanup: close
			});
		} else {

			// Add new session (fallback for old code paths)
			terminalStore.addSession({
				id: sessionId,
				title: title || 'Terminal',
				type: 'local',
				shell: preferredShell || null,
				xterm: terminal,
				fitAddon: fitAddon,
				cleanup: close
			});
		}
	}

	/**
	 * Initialize SSH terminal session
	 * Uses existing backend session created during connection
	 */
	async function initializeSSHSession() {
		if (!sessionId) {
			throw new Error('SSH mode requires a sessionId');
		}

		// Setup event listeners (using extracted utilities)
		const outputUnlisten = await setupOutputListener(sessionId, terminal);
		eventListeners.push(outputUnlisten);

		const exitUnlisten = await setupExitListener(sessionId, 'ssh', terminalEvents);
		eventListeners.push(exitUnlisten);

		const errorUnlisten = await setupErrorListener(sessionId, error => {
			console.error('[useXtermTerminal] SSH terminal error:', error);
		});
		eventListeners.push(errorUnlisten);

		// Signal backend that frontend is ready to receive data
		await terminalCommands.startStreaming(sessionId);

		// Setup user input (using extracted utility)
		onDataDisposable = setupUserInput(terminal, sessionId, sharedState);

		// Register session in store
		terminalStore.addSession({
			id: sessionId,
			title: title || 'SSH',
			type: 'ssh',
			xterm: terminal,
			fitAddon: fitAddon,
			cleanup: close
		});

		// Start connection heartbeat if enabled
		const tabs = get(tabsStore);
		const tab = tabs.tabs.find(t => t.sessionId === sessionId);
		if (tab) {
			const heartbeatSettings = getHeartbeatSettings();
			if (heartbeatSettings.enabled) {
				connectionHeartbeat.start(sessionId, tab.id, {
					interval: heartbeatSettings.interval,
					timeout: heartbeatSettings.timeout,
					maxFailures: heartbeatSettings.maxFailures
				});
			}
		}

		// Change to home directory if specified
		if (homeDirectory && homeDirectory.trim()) {
			setTimeout(() => {
				const cdCommand = `cd "${homeDirectory.trim()}"\r`;
				terminalCommands.writeTerminal(sessionId, cdCommand).catch(e => {
					console.error('[useXtermTerminal] Failed to send cd command:', e);
				});
			}, 500);
		}
	}

	/**
	 * Initialize Telnet terminal session
	 * Similar to SSH but without heartbeat
	 */
	async function initializeTelnetSession() {
		if (!sessionId) {
			throw new Error('Telnet mode requires a sessionId');
		}

		// Setup event listeners (using extracted utilities)
		const outputUnlisten = await setupOutputListener(sessionId, terminal);
		eventListeners.push(outputUnlisten);

		const exitUnlisten = await setupExitListener(sessionId, 'telnet', terminalEvents);
		eventListeners.push(exitUnlisten);

		const errorUnlisten = await setupErrorListener(sessionId, error => {
			console.error('[useXtermTerminal] Telnet terminal error:', error);
		});
		eventListeners.push(errorUnlisten);

		// Signal backend that frontend is ready
		await terminalCommands.startStreaming(sessionId);

		// Setup user input (using extracted utility)
		onDataDisposable = setupUserInput(terminal, sessionId, sharedState);

		// Register session in store
		terminalStore.addSession({
			id: sessionId,
			title: title || 'Telnet',
			type: 'telnet',
			xterm: terminal,
			fitAddon: fitAddon,
			cleanup: close
		});
	}

	/**
	 * Update terminal theme from current CSS variables
	 * Call this when app theme changes (dark/light mode)
	 */
	function updateTheme() {
		const colors = getThemeFromCSS();
		if (terminal && colors && fitAddon) {
			terminal.options.theme = colors;
			// Force repaint via fit() instead of write()
			setTimeout(() => fitAddon.fit(), 50);
		}
	}

	/**
	 * Apply custom terminal settings (font, theme) at runtime
	 * Used when user changes settings while terminal is active
	 *
	 * @param {Object} settings - Terminal appearance settings
	 * @param {string} settings.fontFamily - Font family
	 * @param {number} settings.fontSize - Font size
	 * @param {string} settings.themeId - Theme ID
	 */
	function applyCustomSettings({ fontFamily, fontSize, themeId }) {
		if (!terminal) return;

		// Apply font family
		if (fontFamily && fontFamily !== 'default') {
			terminal.options.fontFamily = fontFamily;
		} else if (fontFamily === 'default') {
			terminal.options.fontFamily = defaultFontFamily;
		}

		// Apply font size
		if (fontSize && fontSize >= 8) {
			terminal.options.fontSize = fontSize;
		}

		// Apply theme
		if (themeId) {
			const theme = getThemeById(themeId);
			if (theme) {
				terminal.options.theme = theme.colors;
			}
		}

		// Force repaint after theme/font changes - fit() triggers full redraw
		if (fitAddon) {
			setTimeout(() => fitAddon.fit(), 50);
		}
	}

	/**
	 * Close terminal session and cleanup all resources
	 */
	async function close() {
		if (sharedState.isClosing) {
			return;
		}
		sharedState.isClosing = true;

		try {
			// Stop heartbeat for SSH connections
			if (sessionId && sessionType === 'ssh') {
				connectionHeartbeat.stop(sessionId);
			}

			// Disconnect resize observer
			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}

			// Dispose onData handler
			if (onDataDisposable) {
				onDataDisposable.dispose();
				onDataDisposable = null;
			}

			// Cleanup event listeners
			eventListeners.forEach(unlisten => {
				if (typeof unlisten === 'function') {
					try {
						unlisten();
					} catch (error) {
						// Ignore errors during cleanup
					}
				}
			});
			eventListeners.length = 0;

			// Close backend terminal session
			if (sessionId) {
				try {
					await terminalCommands.closeTerminal(sessionId);
				} catch (error) {
					if (!error.message?.includes('callback')) {
						console.error('[useXtermTerminal] Error closing backend:', error);
					}
				}
				terminalStore.removeSession(sessionId);
			}

			// Dispose FitAddon
			if (fitAddon) {
				fitAddon.dispose();
				fitAddon = null;
			}

			// Dispose terminal
			if (terminal) {
				terminal.clear();
				terminal.dispose();
				terminal = null;
			}

			sessionId = null;
		} catch (error) {
			console.error('[useXtermTerminal] Failed to close terminal:', error);
		}
	}

	/**
	 * Focus terminal
	 */
	function focus() {
		terminal?.focus();
	}

	/**
	 * Write data to terminal
	 * @param {string} data - Data to write
	 */
	function write(data) {
		terminal?.write(data);
	}

	/**
	 * Clear terminal
	 */
	function clear() {
		terminal?.clear();
	}

	// Cleanup on component unmount
	onDestroy(() => {
		close();
	});

	return {
		initialize,
		close,
		focus,
		write,
		clear,
		updateTheme,
		applyCustomSettings,
		get terminal() {
			return terminal;
		},
		get sessionId() {
			return sessionId;
		}
	};
}
