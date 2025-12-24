import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { applyTheme, getThemeVariables, getTheme } from '$lib/theme';

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
		}
	};
}

export const themeStore = createThemeStore();
