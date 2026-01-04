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

	// Temporarily disable ALL CSS transitions for instant theme change
	const style = document.createElement('style');
	style.id = 'disable-transitions';
	style.textContent = '* { transition: none !important; }';
	document.head.appendChild(style);

	// Apply CSS variables
	Object.entries(variables).forEach(([key, value]) => {
		root.style.setProperty(key, value);
	});

	// Force reflow to apply changes immediately
	void root.offsetHeight;

	// Re-enable transitions after a short delay
	// Using requestAnimationFrame ensures this happens after paint
	requestAnimationFrame(() => {
		const el = document.getElementById('disable-transitions');
		if (el) el.remove();
	});
}

/**
 * Convert hex color to RGB (enhanced with 3-digit hex support and validation)
 * @param {string} hex - Hex color code (#RRGGBB or #RGB)
 * @returns {{r: number, g: number, b: number}} RGB values (0-255)
 */
export function hexToRgb(hex) {
	if (!hex || typeof hex !== 'string') {
		console.warn('[hexToRgb] Invalid hex color:', hex);
		return { r: 0, g: 0, b: 0 }; // Fallback to black
	}

	const cleaned = hex.replace('#', '');

	// Validate hex format
	if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(cleaned)) {
		console.warn('[hexToRgb] Invalid hex format:', hex);
		return { r: 0, g: 0, b: 0 };
	}

	// Handle shorthand hex (#RGB)
	if (cleaned.length === 3) {
		const r = parseInt(cleaned[0] + cleaned[0], 16);
		const g = parseInt(cleaned[1] + cleaned[1], 16);
		const b = parseInt(cleaned[2] + cleaned[2], 16);
		return { r, g, b };
	}

	// Handle full hex (#RRGGBB)
	const r = parseInt(cleaned.substring(0, 2), 16);
	const g = parseInt(cleaned.substring(2, 4), 16);
	const b = parseInt(cleaned.substring(4, 6), 16);
	return { r, g, b };
}

/**
 * Convert RGB object to hex color
 * @param {{r: number, g: number, b: number}} rgb - RGB values (0-255)
 * @returns {string} Hex color code (#RRGGBB)
 */
export function rgbToHex({ r, g, b }) {
	const toHex = n => {
		const clamped = Math.max(0, Math.min(255, Math.round(n)));
		return clamped.toString(16).padStart(2, '0');
	};
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Lighten a hex color by a percentage
 * @param {string} hex - Hex color code
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} Lightened hex color
 */
export function lighten(hex, percent) {
	const { r, g, b } = hexToRgb(hex);
	const amount = percent / 100;

	return rgbToHex({
		r: r + (255 - r) * amount,
		g: g + (255 - g) * amount,
		b: b + (255 - b) * amount
	});
}

/**
 * Darken a hex color by a percentage
 * @param {string} hex - Hex color code
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color
 */
export function darken(hex, percent) {
	const { r, g, b } = hexToRgb(hex);
	const amount = percent / 100;

	return rgbToHex({
		r: r * (1 - amount),
		g: g * (1 - amount),
		b: b * (1 - amount)
	});
}

/**
 * Apply opacity to a hex color
 * @param {string} hex - Hex color code
 * @param {number} opacity - Opacity (0-1)
 * @returns {string} RGBA color string
 */
export function withOpacity(hex, opacity) {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Calculate relative luminance of a color (WCAG)
 * @param {string} hex - Hex color code
 * @returns {number} Luminance value (0-1)
 */
export function getLuminance(hex) {
	const { r, g, b } = hexToRgb(hex);

	const [rs, gs, bs] = [r, g, b].map(c => {
		const val = c / 255;
		return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
	});

	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Check if a color is light or dark
 * @param {string} hex - Hex color code
 * @returns {boolean} True if light, false if dark
 */
export function isLight(hex) {
	return getLuminance(hex) > 0.5;
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

/**
 * Map terminal theme colors to application UI colors
 * @param {Object} terminalTheme - Terminal theme object with 22 colors
 * @returns {Object} CSS custom properties object
 */
export function mapTerminalColorsToAppTheme(terminalTheme) {
	const {
		background,
		foreground,
		cursor,
		cursorAccent,
		selectionBackground,
		black,
		red,
		green,
		yellow,
		blue,
		magenta,
		cyan,
		white,
		brightBlack,
		brightRed,
		brightGreen,
		brightYellow,
		brightBlue,
		brightMagenta,
		brightCyan,
		brightWhite
	} = terminalTheme;

	// Determine if background is light or dark for adaptive adjustments
	const bgIsLight = isLight(background);

	// Background colors - create layered shades
	const bgPrimary = background;
	const bgSecondary = bgIsLight ? darken(background, 5) : lighten(background, 5);
	const bgTertiary = bgIsLight ? darken(background, 8) : lighten(background, 8);
	const bgElevated = bgIsLight ? lighten(background, 3) : lighten(background, 10);
	const bgSurface = background; // Same as primary for inputs
	const bgHover = bgIsLight ? darken(background, 12) : lighten(background, 12);
	const bgActive = bgIsLight ? darken(background, 15) : lighten(background, 15);

	// Text colors - use foreground with opacity variations
	const textPrimary = foreground;
	const textSecondary = withOpacity(foreground, 0.7);
	const textTertiary = withOpacity(foreground, 0.5);
	const textDisabled = withOpacity(foreground, 0.35);

	// Border color
	const border = bgIsLight ? darken(background, 15) : lighten(background, 15);

	// Semantic colors from ANSI palette
	const primary = blue;
	const primaryHover = brightBlue;
	const secondary = magenta;
	const secondaryHover = brightMagenta;
	const success = green;
	const error = red;
	const warning = yellow;

	// Tab active colors (using green accent)
	const tabActiveBg = darken(green, 70);
	const tabActiveText = green;
	const tabActiveIcon = green;

	return {
		// Background colors
		'--color-bg-primary': bgPrimary,
		'--color-bg-secondary': bgSecondary,
		'--color-bg-tertiary': bgTertiary,
		'--color-bg-elevated': bgElevated,
		'--color-bg-surface': bgSurface,
		'--color-bg-hover': bgHover,
		'--color-bg-active': bgActive,

		// Text colors
		'--color-text-primary': textPrimary,
		'--color-text-secondary': textSecondary,
		'--color-text-tertiary': textTertiary,
		'--color-text-disabled': textDisabled,

		// Border
		'--color-border': border,

		// Semantic colors
		'--color-primary': primary,
		'--color-primary-hover': primaryHover,
		'--color-secondary': secondary,
		'--color-secondary-hover': secondaryHover,
		'--color-success': success,
		'--color-error': error,
		'--color-warning': warning,

		// Tab active colors
		'--color-tab-active-bg': tabActiveBg,
		'--color-tab-active-text': tabActiveText,
		'--color-tab-active-icon': tabActiveIcon,

		// Terminal colors (pass through)
		'--terminal-bg': background,
		'--terminal-fg': foreground,
		'--terminal-cursor': cursor,
		'--terminal-cursor-accent': cursorAccent,
		'--terminal-selection': selectionBackground,
		'--terminal-black': black,
		'--terminal-red': red,
		'--terminal-green': green,
		'--terminal-yellow': yellow,
		'--terminal-blue': blue,
		'--terminal-magenta': magenta,
		'--terminal-cyan': cyan,
		'--terminal-white': white,
		'--terminal-bright-black': brightBlack,
		'--terminal-bright-red': brightRed,
		'--terminal-bright-green': brightGreen,
		'--terminal-bright-yellow': brightYellow,
		'--terminal-bright-blue': brightBlue,
		'--terminal-bright-magenta': brightMagenta,
		'--terminal-bright-cyan': brightCyan,
		'--terminal-bright-white': brightWhite
	};
}

/**
 * Read terminal colors from CSS variables (for local terminals)
 * @returns {Object|null} Terminal theme object or null if not in browser
 */
export function readTerminalColorsFromCSS() {
	if (!browser) return null;

	const root = document.documentElement;
	const getColor = varName => {
		return getComputedStyle(root).getPropertyValue(varName).trim();
	};

	return {
		background: getColor('--terminal-bg'),
		foreground: getColor('--terminal-fg'),
		cursor: getColor('--terminal-cursor'),
		cursorAccent: getColor('--terminal-cursor-accent'),
		selectionBackground: getColor('--terminal-selection'),
		black: getColor('--terminal-black'),
		red: getColor('--terminal-red'),
		green: getColor('--terminal-green'),
		yellow: getColor('--terminal-yellow'),
		blue: getColor('--terminal-blue'),
		magenta: getColor('--terminal-magenta'),
		cyan: getColor('--terminal-cyan'),
		white: getColor('--terminal-white'),
		brightBlack: getColor('--terminal-bright-black'),
		brightRed: getColor('--terminal-bright-red'),
		brightGreen: getColor('--terminal-bright-green'),
		brightYellow: getColor('--terminal-bright-yellow'),
		brightBlue: getColor('--terminal-bright-blue'),
		brightMagenta: getColor('--terminal-bright-magenta'),
		brightCyan: getColor('--terminal-bright-cyan'),
		brightWhite: getColor('--terminal-bright-white')
	};
}
