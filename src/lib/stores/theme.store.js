import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
	applyTheme,
	getThemeVariables,
	getTheme,
	mapTerminalColorsToAppTheme,
	readTerminalColorsFromCSS,
	applyCSSVariables
} from '$lib/theme';

/**
 * Theme store - manages dark/light mode
 */
function createThemeStore() {
	// Get initial theme from localStorage or default to 'dark'
	const getInitialTheme = () => {
		if (!browser) return 'dark';

		const stored = localStorage.getItem('theme');
		if (stored === 'light' || stored === 'dark') {
			return stored;
		}

		// Check system preference
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
			return 'light';
		}

		return 'dark';
	};

	const applyThemeToDocument = theme => {
		if (!browser) return;

		const themeConfig = getTheme(theme);
		const variables = getThemeVariables(themeConfig);

		// Apply CSS variables
		const root = document.documentElement;
		Object.entries(variables).forEach(([key, value]) => {
			root.style.setProperty(key, value);
		});

		// Set data-theme attribute
		root.setAttribute('data-theme', theme);

		// Apply theme class
		applyTheme(theme);
	};

	const initialTheme = getInitialTheme();
	const { subscribe, set, update } = writable(initialTheme);

	// Track whether dynamic theming is active
	let isDynamicThemingActive = false;

	// Initialize theme on store creation
	if (browser) {
		applyThemeToDocument(initialTheme);
	}

	return {
		subscribe,
		set: theme => {
			if (browser) {
				localStorage.setItem('theme', theme);
				applyThemeToDocument(theme);
			}
			set(theme);
		},
		toggle: () => {
			update(current => {
				const next = current === 'dark' ? 'light' : 'dark';
				if (browser) {
					localStorage.setItem('theme', next);
					applyThemeToDocument(next);
				}
				return next;
			});
		},
		init: () => {
			if (browser) {
				const theme = getInitialTheme();
				applyThemeToDocument(theme);
			}
		},

		/**
		 * Apply terminal theme colors to app UI (dynamic theming)
		 * @param {Object} terminalColors - Terminal theme color object
		 */
		applyTerminalTheme: terminalColors => {
			if (!browser) return;

			// Map terminal colors to app theme
			const cssVars = mapTerminalColorsToAppTheme(terminalColors);

			// Apply CSS variables instantly (no transitions)
			applyCSSVariables(cssVars);

			isDynamicThemingActive = true;
		},

		/**
		 * Restore default theme (when leaving terminal tabs)
		 */
		restoreDefaultTheme: () => {
			if (!browser || !isDynamicThemingActive) return;

			const currentTheme = initialTheme; // Use store's current theme
			const themeConfig = getTheme(currentTheme);
			const variables = getThemeVariables(themeConfig);

			applyCSSVariables(variables);

			isDynamicThemingActive = false;
		},

		/**
		 * Check if dynamic theming is currently active
		 * @returns {boolean} True if dynamic theming is active
		 */
		isDynamicActive: () => isDynamicThemingActive
	};
}

export const themeStore = createThemeStore();
