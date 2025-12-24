import { tokens } from './tokens.js';

/**
 * Theme configurations
 * Each theme defines how tokens are applied
 */

export const themes = {
	/**
	 * Dark theme (default)
	 */
	dark: {
		name: 'dark',
		label: 'Dark',
		colors: {
			bg: {
				primary: tokens.colors.dark.bg.primary,
				secondary: tokens.colors.dark.bg.secondary,
				tertiary: tokens.colors.dark.bg.tertiary,
				elevated: tokens.colors.dark.bg.elevated,
				surface: tokens.colors.dark.bg.surface,
				hover: tokens.colors.dark.bg.hover,
				active: tokens.colors.dark.bg.active
			},
			text: {
				primary: tokens.colors.dark.text.primary,
				secondary: tokens.colors.dark.text.secondary,
				tertiary: tokens.colors.dark.text.tertiary,
				disabled: tokens.colors.dark.text.disabled
			},
			border: tokens.colors.dark.border,
			// Accent colors are theme-independent
			primary: tokens.colors.accent.blue[500],
			primaryHover: tokens.colors.accent.blue[600],
			secondary: tokens.colors.accent.orange[500],
			secondaryHover: tokens.colors.accent.orange[600],
			success: tokens.colors.accent.green[500],
			error: tokens.colors.accent.red[500],
			warning: tokens.colors.accent.yellow[500],
			// Tab active colors
			tabActiveBg: tokens.colors.tabActive.bg,
			tabActiveText: tokens.colors.tabActive.text,
			tabActiveIcon: tokens.colors.tabActive.icon,
			// Terminal colors
			terminal: tokens.colors.dark.terminal
		}
	},

	/**
	 * Light theme
	 */
	light: {
		name: 'light',
		label: 'Light',
		colors: {
			bg: {
				primary: tokens.colors.light.bg.primary,
				secondary: tokens.colors.light.bg.secondary,
				tertiary: tokens.colors.light.bg.tertiary,
				elevated: tokens.colors.light.bg.elevated,
				surface: tokens.colors.light.bg.surface,
				hover: tokens.colors.light.bg.hover
			},
			text: {
				primary: tokens.colors.light.text.primary,
				secondary: tokens.colors.light.text.secondary,
				tertiary: tokens.colors.light.text.tertiary,
				disabled: tokens.colors.light.text.disabled
			},
			border: tokens.colors.light.border,
			// Accent colors are theme-independent
			primary: tokens.colors.accent.blue[600],
			primaryHover: tokens.colors.accent.blue[700],
			secondary: tokens.colors.accent.orange[600],
			secondaryHover: tokens.colors.accent.orange[700],
			success: tokens.colors.accent.green[600],
			error: tokens.colors.accent.red[600],
			warning: tokens.colors.accent.yellow[500],
			// Tab active colors
			tabActiveBg: tokens.colors.tabActive.bg,
			tabActiveText: tokens.colors.tabActive.text,
			tabActiveIcon: tokens.colors.tabActive.icon,
			// Terminal colors
			terminal: tokens.colors.light.terminal
		}
	}
};

/**
 * Get theme by mode
 * @param {'dark' | 'light'} mode - Theme mode
 * @returns {Object} Theme configuration
 */
export function getTheme(mode) {
	return themes[mode] || themes.dark;
}

/**
 * Get all available themes
 * @returns {Array<Object>} Array of theme objects with name and label
 */
export function getAvailableThemes() {
	return Object.values(themes).map(theme => ({
		name: theme.name,
		label: theme.label
	}));
}
