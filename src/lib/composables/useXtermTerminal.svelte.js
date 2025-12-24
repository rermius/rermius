/**
 * Unified xterm.js Terminal Composable
 * Handles both local and SSH terminal initialization with shared logic
 * Theme-aware terminal that responds to terminal theme changes
 *
 * @param {Object} config - Terminal configuration
 * @param {'local'|'ssh'} config.mode - Terminal mode
 * @param {string} [config.shell] - Shell path (local mode)
 * @param {string} [config.title] - Terminal title
 * @param {string} [config.sessionId] - Existing session ID (SSH mode)
 * @param {string} [config.homeDirectory] - Home directory for cd command (SSH mode)
 * @returns {Object} Terminal interface
 */

import { onDestroy } from 'svelte';
import { get } from 'svelte/store';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
	terminalCommands,
	terminalEvents,
	getAutoReconnectSettings,
	getHeartbeatSettings,
	attemptReconnect
} from '$lib/services';
import { connectionHeartbeat } from '$lib/services/connection-heartbeat.js';
import { terminalStore, tabsStore, workspaceStore } from '$lib/stores';
import { useToast } from './useToast.svelte.js';
import * as appSettingsService from '$lib/services/app-settings';

export function useXtermTerminal(config = {}) {
	const {
		mode = 'local',
		shell = null,
		title = 'Terminal',
		sessionId: existingSessionId = null,
		homeDirectory = null
	} = config;

	const toast = useToast();
	const eventListeners = [];

	// Terminal state
	let terminal = $state(null);
	let fitAddon = null;
	let sessionId = $state(existingSessionId);
	let resizeObserver = null;
	let isClosing = false;
	let onDataDisposable = null;
	let isHandlingIME = false; // Track if we're handling IME input

	/**
	 * Get terminal colors from CSS variables
	 * @returns {Object} xterm.js theme object
	 */
	function getThemeColors() {
		if (typeof window === 'undefined' || typeof document === 'undefined') {
			// Fallback colors for SSR
			return {
				background: '#1e1e2e',
				foreground: '#cdd6f4',
				cursor: '#f5e0dc',
				cursorAccent: '#1e1e2e',
				selectionBackground: '#585b7099',
				scrollbarSliderBackground: 'rgba(255, 255, 255, 0.2)',
				scrollbarSliderHoverBackground: 'rgba(255, 255, 255, 0.35)',
				scrollbarSliderActiveBackground: 'rgba(255, 255, 255, 0.5)',
				black: '#45475a',
				red: '#f38ba8',
				green: '#a6e3a1',
				yellow: '#f9e2af',
				blue: '#89b4fa',
				magenta: '#f5c2e7',
				cyan: '#94e2d5',
				white: '#bac2de',
				brightBlack: '#585b70',
				brightRed: '#f38ba8',
				brightGreen: '#a6e3a1',
				brightYellow: '#f9e2af',
				brightBlue: '#89b4fa',
				brightMagenta: '#f5c2e7',
				brightCyan: '#94e2d5',
				brightWhite: '#a6adc8'
			};
		}

		const root = document.documentElement;
		const getColor = (varName, fallback) => {
			const color = getComputedStyle(root).getPropertyValue(varName).trim();
			return color || fallback;
		};

		return {
			background: getColor('--terminal-bg', '#1e1e2e'),
			foreground: getColor('--terminal-fg', '#cdd6f4'),
			cursor: getColor('--terminal-cursor', '#f5e0dc'),
			cursorAccent: getColor('--terminal-cursor-accent', '#1e1e2e'),
			selectionBackground: getColor('--terminal-selection', '#585b7099'),
			scrollbarSliderBackground: 'rgba(255, 255, 255, 0.2)',
			scrollbarSliderHoverBackground: 'rgba(255, 255, 255, 0.35)',
			scrollbarSliderActiveBackground: 'rgba(255, 255, 255, 0.5)',
			black: getColor('--terminal-black', '#45475a'),
			red: getColor('--terminal-red', '#f38ba8'),
			green: getColor('--terminal-green', '#a6e3a1'),
			yellow: getColor('--terminal-yellow', '#f9e2af'),
			blue: getColor('--terminal-blue', '#89b4fa'),
			magenta: getColor('--terminal-magenta', '#f5c2e7'),
			cyan: getColor('--terminal-cyan', '#94e2d5'),
			white: getColor('--terminal-white', '#bac2de'),
			brightBlack: getColor('--terminal-bright-black', '#585b70'),
			brightRed: getColor('--terminal-bright-red', '#f38ba8'),
			brightGreen: getColor('--terminal-bright-green', '#a6e3a1'),
			brightYellow: getColor('--terminal-bright-yellow', '#f9e2af'),
			brightBlue: getColor('--terminal-bright-blue', '#89b4fa'),
			brightMagenta: getColor('--terminal-bright-magenta', '#f5c2e7'),
			brightCyan: getColor('--terminal-bright-cyan', '#94e2d5'),
			brightWhite: getColor('--terminal-bright-white', '#a6adc8')
		};
	}

	/**
	 * Initialize terminal session
	 * @param {HTMLElement} container - DOM element to mount terminal
	 * @param {Object} options - Additional xterm.js options
	 */
	async function initialize(container, options = {}) {
		try {
			// Get theme colors
			const themeColors = getThemeColors();

			// Create xterm.js instance with current theme
			terminal = new Terminal({
				cursorBlink: true,
				fontSize: 14,
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				theme: themeColors,
				...options
			});

			// Setup fit addon
			fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);

			// Mount terminal
			terminal.open(container);
			fitAddon.fit();

			// Setup IME interception for Vietnamese, Chinese, Japanese, etc.
			setupIMEInterception(container);

			// Mode-specific initialization
			if (mode === 'local') {
				await initializeLocalTerminal();
			} else if (mode === 'ssh') {
				await initializeSSHTerminal();
			}

			// Handle window resize (common for both modes)
			setupResizeObserver(container);

			return sessionId;
		} catch (error) {
			console.error('Failed to initialize terminal:', error);
			toast.show({
				message: `Failed to create terminal: ${error.message}`,
				type: 'error'
			});
			throw error;
		}
	}

	/**
	 * Setup IME interception from textarea (for Vietnamese, Chinese, Japanese, etc.)
	 * @param {HTMLElement} container - Terminal container element
	 */
	function setupIMEInterception(container) {
		// Wait for xterm.js to create textarea
		setTimeout(() => {
			const textarea = container.querySelector('.xterm-helper-textarea');
			if (textarea) {
				textarea.addEventListener('input', e => {
					// Handle IME-replaced text (Vietnamese, Chinese, Japanese, etc.)
					if (e.inputType === 'insertReplacementText' && e.data) {
						isHandlingIME = true;
						const imeText = e.data;

						// Send IME text directly to backend (sessionId will be available after initialization)
						if (!isClosing && terminal) {
							// Use a small delay to ensure sessionId is set (for local terminals)
							setTimeout(() => {
								if (sessionId) {
									terminalCommands.writeTerminal(sessionId, imeText).catch(error => {
										if (!isClosing && terminal && !error.message?.includes('callback')) {
											console.error('Failed to write IME text to terminal:', error);
										}
									});
								}
							}, 0);
						}

						// Clear textarea to prevent xterm.js from processing it
						e.target.value = '';

						// Reset flag
						setTimeout(() => {
							isHandlingIME = false;
						}, 0);
					}
				});
			}
		}, 100); // Small delay to ensure textarea is created
	}

	async function initializeLocalTerminal() {
		let preferredShell = shell;
		if (!preferredShell) {
			try {
				const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
				preferredShell = await appSettingsService.getDefaultShell(workspaceId);
			} catch (error) {
				console.error('Failed to get shell preference:', error);
			}
		}

		if (!sessionId) {
			const { cols, rows } = terminal;
			sessionId = await terminalCommands.createTerminal({
				shell: preferredShell,
				cols,
				rows
			});
		}

		const outputUnlisten = await terminalEvents.onTerminalOutput(sessionId, data => {
			terminal?.write(data);
		});
		eventListeners.push(outputUnlisten);

		const exitUnlisten = await terminalEvents.onTerminalExit(sessionId, exitCode => {
			toast.show({
				message: `Terminal exited with code ${exitCode}`,
				type: 'info'
			});
		});
		eventListeners.push(exitUnlisten);

		const errorUnlisten = await terminalEvents.onTerminalError(sessionId, error => {
			toast.show({
				message: `Terminal error: ${error}`,
				type: 'error'
			});
		});
		eventListeners.push(errorUnlisten);

		onDataDisposable = terminal.onData(data => {
			if (isHandlingIME) {
				return;
			}
			if (isClosing || !sessionId || !terminal) {
				return;
			}
			terminalCommands.writeTerminal(sessionId, data).catch(error => {
				if (!isClosing && terminal && !error.message?.includes('callback')) {
					console.error('Failed to write to terminal:', error);
				}
			});
		});
		terminalStore.addSession({
			id: sessionId,
			title: title || 'Terminal',
			type: 'local',
			shell: preferredShell || null,
			xterm: terminal,
			cleanup: close
		});
	}

	/**
	 * Initialize SSH terminal (uses existing backend session)
	 */
	async function initializeSSHTerminal() {
		if (!sessionId) {
			throw new Error('SSH mode requires a sessionId');
		}

		// Listen for terminal output
		const outputUnlisten = await terminalEvents.onTerminalOutput(sessionId, data => {
			terminal?.write(data);
		});
		eventListeners.push(outputUnlisten);

		// Listen for terminal exit
		const exitUnlisten = await terminalEvents.onTerminalExit(sessionId, async exitEvent => {
			const exitCode = typeof exitEvent === 'number' ? exitEvent : exitEvent.exit_code;
			const reason = typeof exitEvent === 'object' ? exitEvent.reason : null;
			if (mode === 'ssh' && sessionId) {
				// Find tab by sessionId
				const tabs = get(tabsStore);
				const tab = tabs.tabs.find(t => t.sessionId === sessionId);

				if (tab) {
					// Check if this is a user-initiated disconnect
					const isUserClosed = reason === 'user-closed' || tab.reconnectCancelled;

					if (isUserClosed) {
						tabsStore.updateTabConnectionState(tab.id, {
							connectionState: 'FAILED',
							connectionError: 'Connection closed by user'
						});
						return;
					}

					// Check if tab is still in tabs list and not cancelled
					const currentTabs = get(tabsStore);
					const currentTab = currentTabs.tabs.find(t => t.id === tab.id);

					if (currentTab && !currentTab.reconnectCancelled) {
						// Get global auto-reconnect settings
						const settings = getAutoReconnectSettings();

						if (settings.enabled) {
							attemptReconnect(tab.id).catch(error => {
								console.error('[useXtermTerminal] Failed to trigger reconnect:', error);
							});
						} else {
							tabsStore.updateTabConnectionState(tab.id, {
								connectionState: 'FAILED',
								connectionError: 'Connection lost'
							});
						}
					}
				} else {
					console.warn('[useXtermTerminal] Tab not found for sessionId:', sessionId);
				}
			}
		});
		eventListeners.push(exitUnlisten);

		// Listen for terminal errors
		const errorUnlisten = await terminalEvents.onTerminalError(sessionId, console.error);
		eventListeners.push(errorUnlisten);

		// Signal backend that FE is ready to receive data
		await terminalCommands.startStreaming(sessionId);

		terminalStore.addSession({
			id: sessionId,
			title: 'SSH',
			type: 'ssh',
			xterm: terminal,
			cleanup: close
		});

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

		// Change to home directory if specified (for SSH connections)
		if (homeDirectory && homeDirectory.trim()) {
			// Wait a bit for shell to be ready, then send cd command
			setTimeout(() => {
				const cdCommand = `cd "${homeDirectory.trim()}"\r`;
				terminalCommands.writeTerminal(sessionId, cdCommand).catch(e => {
					console.error('[FE] Failed to send cd command:', e);
				});
			}, 500); // Small delay to ensure shell is ready
		}

		// Handle user input
		onDataDisposable = terminal.onData(data => {
			// Skip if we're handling IME (to avoid duplicate)
			if (isHandlingIME) {
				return;
			}
			terminalCommands.writeTerminal(sessionId, data).catch(e => {
				console.error('[FE] Write error:', e);
			});
		});
	}

	/**
	 * Setup resize observer for terminal auto-sizing
	 * @param {HTMLElement} container - Terminal container element
	 */
	function setupResizeObserver(container) {
		resizeObserver = new ResizeObserver(() => {
			// Prevent operations if closing
			if (isClosing || !fitAddon || !terminal || !sessionId) {
				return;
			}
			fitAddon.fit();
			const { cols, rows } = terminal;
			terminalCommands.resizeTerminal(sessionId, cols, rows).catch(error => {
				// Silently ignore errors if closing or callback not found (component unmounted)
				if (!isClosing && terminal && !error.message?.includes('callback')) {
					console.error('Failed to resize terminal:', error);
				}
			});
		});
		resizeObserver.observe(container);
	}

	/**
	 * Update terminal theme from current CSS variables
	 * Call this when app theme changes (dark/light mode)
	 */
	function updateTheme() {
		const colors = getThemeColors();
		if (terminal && colors) {
			terminal.options.theme = colors;
			terminal.write(''); // Force refresh
		}
	}

	/**
	 * Close terminal session and cleanup all resources
	 */
	async function close() {
		if (isClosing) {
			return;
		}
		isClosing = true;

		try {
			// Stop heartbeat for SSH connections
			if (sessionId && mode === 'ssh') {
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
						console.error('Error closing terminal backend:', error);
					}
				}
				terminalStore.removeSession(sessionId);
			}

			// Dispose FitAddon before terminal
			if (fitAddon) {
				fitAddon.dispose();
				fitAddon = null;
			}

			// Clear buffer and dispose terminal
			if (terminal) {
				terminal.clear();
				terminal.dispose();
				terminal = null;
			}

			sessionId = null;
		} catch (error) {
			console.error('Failed to close terminal:', error);
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
		get terminal() {
			return terminal;
		},
		get sessionId() {
			return sessionId;
		}
	};
}
