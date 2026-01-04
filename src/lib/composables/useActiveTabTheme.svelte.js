/**
 * Reactive composable that watches active tab and applies its terminal theme to app
 */
import { tabsStore, themeStore } from '$lib/stores';
import { getHostById, getLocalTerminalSettings } from '$lib/services';
import { getThemeById } from '$lib/constants/terminal-themes.js';
import { readTerminalColorsFromCSS } from '$lib/theme';

export function useActiveTabTheme() {
	let unsubscribe = null;
	let lastAppliedTabId = null;

	/**
	 * Update app theme based on active tab
	 */
	function updateAppTheme(tabs) {
		const activeTab = tabs.tabs.find(t => t.id === tabs.activeTabId);

		// Optimization: Skip if same tab (prevents redundant theme applications)
		if (lastAppliedTabId === tabs.activeTabId) {
			return;
		}

		// Not a terminal tab
		if (!activeTab || activeTab.type !== 'terminal') {
			lastAppliedTabId = tabs.activeTabId;
			themeStore.restoreDefaultTheme();
			return;
		}

		// Still connecting
		if (activeTab.connectionState === 'CONNECTING') {
			return;
		}

		let terminalTheme = null;

		// SSH terminal: get theme from host config
		if (activeTab.hostId) {
			const host = getHostById(activeTab.hostId);
			if (host?.terminalAppearance?.themeId) {
				const theme = getThemeById(host.terminalAppearance.themeId);
				terminalTheme = theme?.colors;
			}
		} else {
			// Local terminal: use global local terminal settings
			const localSettings = getLocalTerminalSettings();
			if (localSettings.themeId) {
				const theme = getThemeById(localSettings.themeId);
				terminalTheme = theme?.colors;
			}
		}

		// Fallback to CSS variables if no theme found
		if (!terminalTheme) {
			terminalTheme = readTerminalColorsFromCSS();
		}

		if (terminalTheme) {
			lastAppliedTabId = tabs.activeTabId;
			themeStore.applyTerminalTheme(terminalTheme);
		} else {
			lastAppliedTabId = tabs.activeTabId;
			themeStore.restoreDefaultTheme();
		}
	}

	/**
	 * Initialize watcher
	 */
	function init() {
		unsubscribe = tabsStore.subscribe(tabs => {
			updateAppTheme(tabs);
		});
	}

	/**
	 * Force update
	 */
	function forceUpdate() {
		lastAppliedTabId = null;
		let currentTabs;
		const unsub = tabsStore.subscribe(t => {
			currentTabs = t;
		});
		unsub();
		updateAppTheme(currentTabs);
	}

	/**
	 * Cleanup
	 */
	function destroy() {
		if (unsubscribe) {
			unsubscribe();
		}
	}

	return {
		init,
		forceUpdate,
		destroy
	};
}
