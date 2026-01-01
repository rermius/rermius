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
	 * Register a handler that needs context (e.g., file browser actions)
	 * @param {string} actionName - Name of the action
	 * @param {Function} handler - Handler that receives (event, context)
	 */
	registerWithContext(actionName, handler) {
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
	 * Check if event matches any APP shortcut (not file browser shortcuts)
	 * @param {KeyboardEvent} event - Keyboard event
	 * @returns {boolean} True if it's an app shortcut
	 */
	isAppShortcut(event) {
		const key = this.formatKeyCombo(event);

		// App shortcuts (not file browser shortcuts)
		const appShortcutActions = [
			'newTerminal',
			'closeTab',
			'nextTab',
			'prevTab',
			'openSettings',
			'toggleFileManager'
		];

		// Check if any app shortcut matches this key combo
		for (const actionName of appShortcutActions) {
			const shortcut = this.shortcuts.get(actionName);
			if (shortcut && this.normalizeShortcut(shortcut) === key) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Handle keydown event and trigger matching shortcut
	 * @param {KeyboardEvent} event - Keyboard event
	 * @returns {boolean} True if shortcut was handled
	 */
	handleKeyDown(event) {
		const key = this.formatKeyCombo(event);

		// Allow basic editing shortcuts in input/textarea elements
		const target = event.target;
		const isEditableElement =
			target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

		// Basic editing shortcuts that should always work in editable elements
		const basicEditingShortcuts = [
			'Ctrl+C', // Copy
			'Ctrl+V', // Paste
			'Ctrl+X', // Cut
			'Ctrl+A', // Select All
			'Ctrl+Z', // Undo
			'Ctrl+Y', // Redo
			'Ctrl+Shift+Z' // Redo (alternative)
		];

		// Always allow basic editing shortcuts in editable elements
		if (isEditableElement && basicEditingShortcuts.includes(key)) {
			return false; // Let browser handle it
		}

		// For non-editable elements, allow basic shortcuts unless explicitly registered
		if (basicEditingShortcuts.includes(key)) {
			// Only prevent if we have a registered handler for this specific shortcut
			const hasRegisteredHandler = Array.from(this.shortcuts.entries()).some(
				([actionName, shortcut]) =>
					this.normalizeShortcut(shortcut) === key && this.activeHandlers.has(actionName)
			);
			if (!hasRegisteredHandler) {
				return false; // Let browser handle it
			}
		}

		// Find matching action
		for (const [actionName, shortcut] of this.shortcuts.entries()) {
			if (this.normalizeShortcut(shortcut) === key) {
				const handler = this.activeHandlers.get(actionName);
				if (handler) {
					event.preventDefault();
					event.stopPropagation();
					// Pass event details for context-aware handlers
					handler(event, { actionName, originalEvent: event });
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
		else if (key.startsWith('F') && key.length <= 3)
			parts.push(key); // F1-F12
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
