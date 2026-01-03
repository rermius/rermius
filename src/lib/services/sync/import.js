import { get } from 'svelte/store';
import { hostsStore, saveHosts } from '../data/hosts.js';
import { snippetsStore, saveSnippets } from '../data/snippets.js';
import { keychainStore, saveKeychain } from '../data/keychain.js';
import { tauriFs } from '../infra/tauri/fs.js';

/**
 * Merge imported items with existing items (update if ID exists, add if new)
 * @param {Array} existingItems - Current items from store
 * @param {Array} importedItems - Items from import file
 * @returns {Array} Merged items
 */
function mergeItems(existingItems, importedItems) {
	if (!importedItems || !Array.isArray(importedItems)) {
		return existingItems;
	}

	const merged = [...existingItems];
	const existingIds = new Set(existingItems.map(item => item.id));

	for (const importedItem of importedItems) {
		if (!importedItem.id) {
			// Skip items without ID
			continue;
		}

		const existingIndex = merged.findIndex(item => item.id === importedItem.id);

		if (existingIndex >= 0) {
			// Update existing item
			merged[existingIndex] = importedItem;
		} else {
			// Add new item
			merged.push(importedItem);
		}
	}

	return merged;
}

/**
 * Import sync data from file
 * @param {string} filePath - Path to import file
 * @returns {Promise<{success: boolean, message: string, stats: Object}>}
 */
export async function importSyncData(filePath) {
	try {
		// 1. Read file
		const fileContent = await tauriFs.readFile(filePath);

		// 2. Parse JSON
		let importData;
		try {
			importData = JSON.parse(fileContent);
		} catch (parseError) {
			return {
				success: false,
				message: 'Invalid JSON format',
				stats: null
			};
		}

		// 3. Validate import data structure
		if (!importData.version || !importData.data) {
			return {
				success: false,
				message: 'Invalid backup file format',
				stats: null
			};
		}

		// 4. Get current data from stores
		const currentHosts = get(hostsStore);
		const currentSnippets = get(snippetsStore);
		const currentKeychain = get(keychainStore);

		// 5. Initialize stats
		const stats = {
			hostsAdded: 0,
			hostsUpdated: 0,
			groupsAdded: 0,
			groupsUpdated: 0,
			snippetsAdded: 0,
			snippetsUpdated: 0,
			keysAdded: 0,
			keysUpdated: 0
		};

		// 6. Merge hosts
		let mergedHosts = currentHosts.hosts || [];
		if (importData.data.hosts) {
			const existingHostIds = new Set(mergedHosts.map(h => h.id));
			mergedHosts = mergeItems(mergedHosts, importData.data.hosts);

			// Calculate stats
			for (const host of importData.data.hosts) {
				if (existingHostIds.has(host.id)) {
					stats.hostsUpdated++;
				} else {
					stats.hostsAdded++;
				}
			}
		}

		// 7. Merge groups
		let mergedGroups = currentHosts.groups || [];
		if (importData.data.groups) {
			const existingGroupIds = new Set(mergedGroups.map(g => g.id));
			mergedGroups = mergeItems(mergedGroups, importData.data.groups);

			// Calculate stats
			for (const group of importData.data.groups) {
				if (existingGroupIds.has(group.id)) {
					stats.groupsUpdated++;
				} else {
					stats.groupsAdded++;
				}
			}
		}

		// 8. Merge snippets
		let mergedSnippets = currentSnippets.snippets || [];
		if (importData.data.snippets) {
			const existingSnippetIds = new Set(mergedSnippets.map(s => s.id));
			mergedSnippets = mergeItems(mergedSnippets, importData.data.snippets);

			// Calculate stats
			for (const snippet of importData.data.snippets) {
				if (existingSnippetIds.has(snippet.id)) {
					stats.snippetsUpdated++;
				} else {
					stats.snippetsAdded++;
				}
			}
		}

		// 9. Merge keychain keys
		let mergedKeys = currentKeychain.keys || [];
		if (importData.data.keychain?.keys) {
			const existingKeyIds = new Set(mergedKeys.map(k => k.id));
			mergedKeys = mergeItems(mergedKeys, importData.data.keychain.keys);

			// Calculate stats
			for (const key of importData.data.keychain.keys) {
				if (existingKeyIds.has(key.id)) {
					stats.keysUpdated++;
				} else {
					stats.keysAdded++;
				}
			}
		}

		// 10. Merge keychain vaults
		let mergedVaults = currentKeychain.vaults || [];
		if (importData.data.keychain?.vaults) {
			mergedVaults = mergeItems(mergedVaults, importData.data.keychain.vaults);
		}

		// 11. Update stores with merged data
		hostsStore.set({
			...currentHosts,
			hosts: mergedHosts,
			groups: mergedGroups
		});

		snippetsStore.set({
			...currentSnippets,
			snippets: mergedSnippets
		});

		keychainStore.set({
			...currentKeychain,
			keys: mergedKeys,
			vaults: mergedVaults
		});

		// 12. Save to files (parallel for performance)
		await Promise.all([saveHosts(), saveSnippets(), saveKeychain()]);

		console.log('[ImportService] Import successful:', stats);

		return {
			success: true,
			message: 'Import successful',
			stats
		};
	} catch (error) {
		console.error('[ImportService] Import failed:', error);

		return {
			success: false,
			message: error.message || 'Import failed',
			stats: null
		};
	}
}
