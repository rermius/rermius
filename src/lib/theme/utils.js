import { browser } from '$app/environment';

/**
 * Theme utility functions
 */

/**
 * Apply theme to document root
 * @param {'dark' | 'light'} mode - Theme mode
 */
export function applyTheme(mode) {
	if (!browser) return;

	const root = document.documentElement;

	if (mode === 'dark') {
		root.classList.add('dark');
		root.classList.remove('light');
	} else {
		root.classList.add('light');
		root.classList.remove('dark');
	}
}

/**
 * Get system theme preference
 * @returns {'dark' | 'light'} System theme preference
 */
export function getSystemTheme() {
	if (!browser) return 'dark';

	const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
	return darkModeQuery.matches ? 'dark' : 'light';
}

/**
 * Listen for system theme changes
 * @param {Function} callback - Callback function (receives theme mode)
 * @returns {Function} Cleanup function to remove listener
 */
export function watchSystemTheme(callback) {
	if (!browser) return () => {};

	const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

	const handler = e => {
		callback(e.matches ? 'dark' : 'light');
	};

	darkModeQuery.addEventListener('change', handler);

	return () => {
		darkModeQuery.removeEventListener('change', handler);
	};
}

/**
 * Get CSS custom properties for a theme
 * @param {Object} theme - Theme object
 * @returns {Object} CSS custom properties
 */
export function getThemeVariables(theme) {
	const vars = {
		'--color-bg-primary': theme.colors.bg.primary,
		'--color-bg-secondary': theme.colors.bg.secondary,
		'--color-bg-tertiary': theme.colors.bg.tertiary,
		'--color-bg-elevated': theme.colors.bg.elevated,
		'--color-bg-surface': theme.colors.bg.surface || theme.colors.bg.tertiary,
		'--color-bg-hover': theme.colors.bg.hover || theme.colors.bg.tertiary,
		'--color-bg-active': theme.colors.bg.active || theme.colors.bg.elevated,
		'--color-text-primary': theme.colors.text.primary,
		'--color-text-secondary': theme.colors.text.secondary,
		'--color-text-tertiary': theme.colors.text.tertiary,
		'--color-text-disabled': theme.colors.text.disabled,
		'--color-border': theme.colors.border,
		'--color-primary': theme.colors.primary,
		'--color-primary-hover': theme.colors.primaryHover,
		'--color-secondary': theme.colors.secondary,
		'--color-secondary-hover': theme.colors.secondaryHover,
		'--color-success': theme.colors.success,
		'--color-error': theme.colors.error,
		'--color-warning': theme.colors.warning,
		// Tab active colors
		'--color-tab-active-bg': theme.colors.tabActiveBg,
		'--color-tab-active-text': theme.colors.tabActiveText,
		'--color-tab-active-icon': theme.colors.tabActiveIcon
	};

	// Add terminal colors if available
	if (theme.colors.terminal) {
		const terminal = theme.colors.terminal;
		vars['--terminal-bg'] = terminal.background;
		vars['--terminal-fg'] = terminal.foreground;
		vars['--terminal-cursor'] = terminal.cursor;
		vars['--terminal-cursor-accent'] = terminal.cursorAccent;
		vars['--terminal-selection'] = terminal.selectionBackground;
		// ANSI colors
		vars['--terminal-black'] = terminal.black;
		vars['--terminal-red'] = terminal.red;
		vars['--terminal-green'] = terminal.green;
		vars['--terminal-yellow'] = terminal.yellow;
		vars['--terminal-blue'] = terminal.blue;
		vars['--terminal-magenta'] = terminal.magenta;
		vars['--terminal-cyan'] = terminal.cyan;
		vars['--terminal-white'] = terminal.white;
		vars['--terminal-bright-black'] = terminal.brightBlack;
		vars['--terminal-bright-red'] = terminal.brightRed;
		vars['--terminal-bright-green'] = terminal.brightGreen;
		vars['--terminal-bright-yellow'] = terminal.brightYellow;
		vars['--terminal-bright-blue'] = terminal.brightBlue;
		vars['--terminal-bright-magenta'] = terminal.brightMagenta;
		vars['--terminal-bright-cyan'] = terminal.brightCyan;
		vars['--terminal-bright-white'] = terminal.brightWhite;
	}

	return vars;
}

/**
 * Apply CSS custom properties to document
 * @param {Object} variables - CSS custom properties object
 */
export function applyCSSVariables(variables) {
	if (!browser) return;

	const root = document.documentElement;

	Object.entries(variables).forEach(([key, value]) => {
		root.style.setProperty(key, value);
	});
}

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color code
 * @returns {Object} RGB values
 */
export function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16)
			}
		: null;
}

/**
 * Get contrasting text color for background
 * @param {string} bgColor - Background color (hex)
 * @returns {'dark' | 'light'} Contrasting text color theme
 */
export function getContrastTextColor(bgColor) {
	const rgb = hexToRgb(bgColor);
	if (!rgb) return 'dark';

	// Calculate relative luminance
	const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

	return luminance > 0.5 ? 'dark' : 'light';
}
