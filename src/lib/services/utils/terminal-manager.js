/**
 * Centralized Terminal Manager
 * Handles creation of local terminals with shell preferences
 */

import { get } from 'svelte/store';
import { terminalCommands } from '../infra/tauri/index.js';
import { getDefaultShell } from '../data/app-settings.js';
import { workspaceStore, tabsStore, terminalStore } from '$lib/stores';

/**
 * Create a new local terminal with shell preferences
 * @param {Object} options - Terminal options
 * @param {number} [options.cols=80] - Terminal columns
 * @param {number} [options.rows=24] - Terminal rows
 * @param {string} [options.title] - Terminal title
 * @returns {Promise<string>} Session ID
 */
export async function createLocalTerminal(options = {}) {
	const { cols = 80, rows = 24, title } = options;

	// Get shell preference from settings
	const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
	const preferredShell = await getDefaultShell(workspaceId);

	// Create backend terminal session
	const sessionId = await terminalCommands.createTerminal({
		cols,
		rows,
		shell: preferredShell
	});

	// Add placeholder session to terminalStore so useXtermTerminal knows it's a local terminal
	// The xterm instance and other properties will be populated when TerminalComponent initializes
	terminalStore.addSession({
		id: sessionId,
		title: title || 'Terminal',
		type: 'local',
		shell: preferredShell,
		xterm: null, // Will be set by useXtermTerminal.initialize()
		fitAddon: null,
		cleanup: null
	});

	const terminalCount = get(tabsStore).tabs.filter(t => t.type === 'terminal').length;
	const terminalTitle = title || `Terminal ${terminalCount + 1}`;
	tabsStore.addTerminalTab(sessionId, terminalTitle);

	return sessionId;
}
