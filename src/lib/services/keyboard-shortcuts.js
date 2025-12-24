/**
 * Keyboard Shortcut Manager
 * Handles global keyboard shortcuts with integration to app settings
 */
import * as appSettingsService from './app-settings';
import { workspaceStore } from '$lib/stores';
import { get } from 'svelte/store';

class KeyboardShortcutManager {
	constructor() {
		this.shortcuts = new Map();
		this.activeHandlers = new Map();
	}

	/**
	 * Initialize shortcut manager and load shortcuts from settings
	 */
	async init() {
		const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
		const settings = await appSettingsService.loadSettings(workspaceId);
		this.shortcuts = new Map(Object.entries(settings.shortcuts || {}));
	}

	/**
	 * Register a handler for a specific action
	 * @param {string} actionName - Name of the action
	 * @param {Function} handler - Handler function to call when shortcut is triggered
	 */
	register(actionName, handler) {
		this.activeHandlers.set(actionName, handler);
	}

	/**
	 * Unregister a handler for a specific action
	 * @param {string} actionName - Name of the action
	 */
	unregister(actionName) {
		this.activeHandlers.delete(actionName);
	}

	/**
	 * Handle keydown event and trigger matching shortcut
	 * @param {KeyboardEvent} event - Keyboard event
	 * @returns {boolean} True if shortcut was handled
	 */
	handleKeyDown(event) {
		const key = this.formatKeyCombo(event);

		// Find matching action
		for (const [actionName, shortcut] of this.shortcuts.entries()) {
			if (this.normalizeShortcut(shortcut) === key) {
				const handler = this.activeHandlers.get(actionName);
				if (handler) {
					event.preventDefault();
					event.stopPropagation();
					handler(event);
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Format keyboard event into key combination string
	 * @param {KeyboardEvent} event - Keyboard event
	 * @returns {string} Key combination (e.g., "Ctrl+T", "Ctrl+Shift+Tab")
	 */
	formatKeyCombo(event) {
		const parts = [];
		if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
		if (event.altKey) parts.push('Alt');
		if (event.shiftKey) parts.push('Shift');

		const key = event.key;
		if (key === 'Tab') parts.push('Tab');
		else if (key === 'Delete') parts.push('Delete');
		else if (key.startsWith('F') && key.length <= 3) parts.push(key); // F1-F12
		else if (key.length === 1) parts.push(key.toUpperCase());

		return parts.join('+');
	}

	/**
	 * Normalize shortcut string for cross-platform compatibility
	 * @param {string} shortcut - Shortcut string
	 * @returns {string} Normalized shortcut
	 */
	normalizeShortcut(shortcut) {
		// Normalize "Cmd" to "Ctrl" for cross-platform compatibility
		return shortcut.replace('Cmd', 'Ctrl');
	}

	/**
	 * Update a shortcut in settings
	 * @param {string} actionName - Name of the action
	 * @param {string} newShortcut - New shortcut combination
	 */
	async updateShortcut(actionName, newShortcut) {
		const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
		this.shortcuts.set(actionName, newShortcut);

		const shortcutsObj = Object.fromEntries(this.shortcuts);
		await appSettingsService.updateShortcuts(workspaceId, shortcutsObj);
	}

	/**
	 * Get shortcut for a specific action
	 * @param {string} actionName - Name of the action
	 * @returns {string|null} Shortcut combination or null
	 */
	getShortcut(actionName) {
		return this.shortcuts.get(actionName) || null;
	}

	/**
	 * Get all shortcuts as an object
	 * @returns {Object} All shortcuts
	 */
	getAllShortcuts() {
		return Object.fromEntries(this.shortcuts);
	}
}

export const keyboardShortcutManager = new KeyboardShortcutManager();
