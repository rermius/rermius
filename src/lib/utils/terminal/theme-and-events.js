/**
 * Shared Terminal Utilities
 * Extracted common functionality to reduce code duplication
 */

import { terminalEvents, terminalCommands } from '$lib/services';
import { getThemeById } from '$lib/constants/terminal-themes';
import { getHostById, getLocalTerminalSettings } from '$lib/services';

/**
 * Load terminal theme colors based on session type and configuration
 *
 * @param {string} sessionType - 'local' | 'ssh' | 'telnet'
 * @param {string|null} hostId - Host ID for SSH sessions
 * @param {Function} getFallbackTheme - Function to get fallback CSS theme colors
 * @returns {Object|null} xterm.js theme color object or null if no custom theme
 */
export function loadTerminalTheme(sessionType, hostId, getFallbackTheme) {
	if (sessionType === 'ssh' && hostId) {
		// SSH terminal: use host-specific theme
		const host = getHostById(hostId);
		if (host?.terminalAppearance?.themeId) {
			const theme = getThemeById(host.terminalAppearance.themeId);
			if (theme) {
				return theme.colors;
			}
		}
	} else if (sessionType === 'local') {
		// Local terminal: use global local terminal settings
		const localSettings = getLocalTerminalSettings();
		if (localSettings.themeId) {
			const theme = getThemeById(localSettings.themeId);
			if (theme) {
				return theme.colors;
			}
		}
	}

	// Fallback to CSS variables theme
	return getFallbackTheme ? getFallbackTheme() : null;
}

/**
 * Load terminal font configuration based on session type
 *
 * @param {string} sessionType - 'local' | 'ssh' | 'telnet'
 * @param {string|null} hostId - Host ID for SSH sessions
 * @returns {Object} Font configuration { fontSize, fontFamily }
 */
export function loadTerminalFont(sessionType, hostId) {
	const result = {
		fontSize: null,
		fontFamily: null
	};

	if (sessionType === 'ssh' && hostId) {
		// SSH terminal: use host-specific font settings
		const host = getHostById(hostId);
		if (host?.terminalAppearance) {
			if (host.terminalAppearance.fontSize) {
				result.fontSize = host.terminalAppearance.fontSize;
			}
			if (host.terminalAppearance.fontFamily && host.terminalAppearance.fontFamily !== 'default') {
				result.fontFamily = host.terminalAppearance.fontFamily;
			}
		}
	} else if (sessionType === 'local') {
		// Local terminal: use global local terminal settings
		const localSettings = getLocalTerminalSettings();
		if (localSettings.fontSize) {
			result.fontSize = localSettings.fontSize;
		}
		if (localSettings.fontFamily && localSettings.fontFamily !== 'default') {
			result.fontFamily = localSettings.fontFamily;
		}
	}

	return result;
}

/**
 * Setup terminal output event listener
 * Writes backend terminal output to xterm.js instance
 *
 * @param {string} sessionId - Terminal session ID
 * @param {Terminal} terminal - xterm.js Terminal instance
 * @returns {Function} Unlisten function
 */
export async function setupOutputListener(sessionId, terminal) {
	return await terminalEvents.onTerminalOutput(sessionId, data => {
		terminal?.write(data);
	});
}

/**
 * Setup terminal error event listener
 *
 * @param {string} sessionId - Terminal session ID
 * @param {Function} errorHandler - Error handler function
 * @returns {Function} Unlisten function
 */
export async function setupErrorListener(sessionId, errorHandler) {
	return await terminalEvents.onTerminalError(sessionId, errorHandler);
}

/**
 * Setup user input handler for terminal
 * Writes user keyboard input to backend terminal session
 *
 * @param {Terminal} terminal - xterm.js Terminal instance
 * @param {string} sessionId - Terminal session ID
 * @param {Object} state - Shared state object
 * @param {boolean} state.isHandlingIME - Flag to prevent duplicate IME input
 * @param {boolean} state.isClosing - Flag to prevent writes during cleanup
 * @returns {Object} Disposable with dispose() method
 */
export function setupUserInput(terminal, sessionId, state) {
	return terminal.onData(data => {
		// Skip if handling IME input (Vietnamese, Chinese, Japanese, etc.)
		if (state.isHandlingIME) {
			return;
		}

		// Skip if session is closing or invalid
		if (state.isClosing || !sessionId || !terminal) {
			return;
		}

		// Write user input to backend
		terminalCommands.writeTerminal(sessionId, data).catch(error => {
			// Ignore callback errors during cleanup
			if (!state.isClosing && terminal && !error.message?.includes('callback')) {
				console.error('[Terminal] Failed to write user input:', error);
			}
		});
	});
}

/**
 * Setup resize observer for automatic terminal resizing
 *
 * @param {HTMLElement} container - Terminal container element
 * @param {FitAddon} fitAddon - xterm.js FitAddon instance
 * @param {Terminal} terminal - xterm.js Terminal instance
 * @param {string} sessionId - Terminal session ID
 * @param {Object} state - Shared state object
 * @param {boolean} state.isClosing - Flag to prevent operations during cleanup
 * @returns {ResizeObserver} ResizeObserver instance
 */
export function setupResizeObserver(container, fitAddon, terminal, sessionId, state) {
	const resizeObserver = new ResizeObserver(() => {
		// Prevent operations if closing or invalid state
		if (state.isClosing || !fitAddon || !terminal || !sessionId) {
			return;
		}

		// Fit terminal to container size
		fitAddon.fit();

		// Notify backend of new dimensions
		const { cols, rows } = terminal;
		terminalCommands.resizeTerminal(sessionId, cols, rows).catch(error => {
			// Silently ignore errors during cleanup
			if (!state.isClosing && terminal && !error.message?.includes('callback')) {
				console.error('[Terminal] Failed to resize:', error);
			}
		});
	});

	resizeObserver.observe(container);
	return resizeObserver;
}

/**
 * Setup IME (Input Method Editor) interception for CJK languages
 * Handles Vietnamese, Chinese, Japanese, Korean input from textarea
 *
 * @param {HTMLElement} container - Terminal container element
 * @param {string} sessionId - Terminal session ID
 * @param {Object} state - Shared state object
 * @param {boolean} state.isHandlingIME - Flag to track IME input
 * @param {boolean} state.isClosing - Flag to prevent operations during cleanup
 * @param {Terminal} terminal - xterm.js Terminal instance
 */
export function setupIMEInterception(container, sessionId, state, terminal) {
	// Wait for xterm.js to create textarea element
	setTimeout(() => {
		const textarea = container.querySelector('.xterm-helper-textarea');
		if (!textarea) return;

		textarea.addEventListener('input', e => {
			// Detect IME replacement text (CJK input completion)
			if (e.inputType === 'insertReplacementText' && e.data) {
				state.isHandlingIME = true;
				const imeText = e.data;

				// Send IME text to backend
				if (!state.isClosing && terminal) {
					// Small delay to ensure sessionId is set
					setTimeout(() => {
						if (sessionId) {
							terminalCommands.writeTerminal(sessionId, imeText).catch(error => {
								if (!state.isClosing && terminal && !error.message?.includes('callback')) {
									console.error('[Terminal] Failed to write IME text:', error);
								}
							});
						}
					}, 0);
				}

				// Clear textarea to prevent xterm.js from processing it
				e.target.value = '';

				// Reset IME flag
				setTimeout(() => {
					state.isHandlingIME = false;
				}, 0);
			}
		});
	}, 100); // Small delay to ensure textarea is created by xterm.js
}

/**
 * Get terminal theme colors from CSS variables
 * Fallback for when no custom theme is configured
 *
 * @returns {Object} xterm.js theme color object
 */
export function getThemeFromCSS() {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		// SSR fallback colors
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
