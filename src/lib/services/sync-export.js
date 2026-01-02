import { get } from 'svelte/store';
import { hostsStore } from './hosts.js';
import { snippetsStore } from './snippets.js';
import { keychainStore } from './keychain.js';
import { workspaceStore } from '../stores/workspace.store.js';
import { tauriFs } from './tauri/fs.js';
import { join } from '@tauri-apps/api/path';

/**
 * Collect export data from stores based on sync options
 * @param {Object} syncOptions - Sync options from sync settings
 * @returns {Object} Collected data for export
 */
function collectExportData(syncOptions) {
	const hostsData = get(hostsStore);
	const snippetsData = get(snippetsStore);
	const keychainData = get(keychainStore);

	const data = {};

	// Include hosts if syncOptions.profiles is enabled
	if (syncOptions.profiles && hostsData.hosts?.length) {
		data.hosts = hostsData.hosts;
	}

	// Include groups if syncOptions.addressBookmarks is enabled
	if (syncOptions.addressBookmarks && hostsData.groups?.length) {
		data.groups = hostsData.groups;
	}

	// Include snippets if syncOptions.quickCommands is enabled
	if (syncOptions.quickCommands && snippetsData.snippets?.length) {
		data.snippets = snippetsData.snippets;
	}

	// Always include keychain if keys exist
	if (keychainData.keys?.length) {
		data.keychain = {
			keys: keychainData.keys,
			vaults: keychainData.vaults || []
		};
	}

	return data;
}

/**
 * Generate timestamped export filename
 * @returns {string} Filename in format: rermius-backup-YYYY-MM-DD-HHmmss.json
 */
export function generateExportFilename() {
	const now = new Date();

	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	return `rermius-backup-${year}-${month}-${day}-${hours}${minutes}${seconds}.json`;
}

/**
 * Export sync data to file
 * @param {Object} options
 * @param {string} options.destinationFolder - User-selected destination folder path
 * @param {Object} options.syncOptions - Sync options (which data types to export)
 * @returns {Promise<{success: boolean, filePath: string|null, message: string}>}
 */
export async function exportSyncData({ destinationFolder, syncOptions }) {
	try {
		// 1. Collect data from stores
		const data = collectExportData(syncOptions);

		// 2. Get workspace info
		const workspace = get(workspaceStore);
		const currentWorkspace = workspace.workspaces.find(
			w => w.id === workspace.currentWorkspaceId
		);

		// 3. Build export payload
		const payload = {
			version: '1.0.0',
			exportTimestamp: new Date().toISOString(),
			workspace: {
				id: workspace.currentWorkspaceId,
				name: currentWorkspace?.name || 'Default'
			},
			data,
			metadata: {
				appVersion: '1.2.0', // TODO: Get from package.json dynamically
				platform: navigator.platform,
				encrypted: false,
				syncOptions: { ...syncOptions }
			}
		};

		// 4. Generate filename
		const filename = generateExportFilename();

		// 5. Build full file path
		const filePath = await join(destinationFolder, filename);

		// 6. Write file (no formatting to save space)
		await tauriFs.writeFile(filePath, JSON.stringify(payload));

		console.log('[ExportService] Export successful:', filePath);

		return {
			success: true,
			filePath,
			message: 'Export successful'
		};
	} catch (error) {
		console.error('[ExportService] Export failed:', error);

		return {
			success: false,
			filePath: null,
			message: error.message || 'Export failed'
		};
	}
}
