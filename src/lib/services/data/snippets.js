/**
 * Snippets service for managing quick command snippets
 */
import { tauriFs } from '../infra/tauri/fs';
import { writable, get } from 'svelte/store';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';
import { getCurrentWorkspaceId } from './workspaces.js';

// Default snippets structure
const defaultSnippets = {
	version: '1.0.0',
	metadata: {
		lastModified: new Date().toISOString(),
		lastSync: null,
		deviceId: crypto.randomUUID(),
		encryptionEnabled: false,
		encryptionAlgorithm: null
	},
	snippets: [],
	settings: {
		autoSync: false,
		syncInterval: 300,
		encryptBeforeSync: false,
		backupEnabled: true,
		backupCount: 5
	}
};

// Snippets store
export const snippetsStore = writable(defaultSnippets);

/**
 * Get snippets file path
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
async function getSnippetsFilePath(workspaceId = null) {
	const appDataDirPath = await appDataDir();
	const wsId = workspaceId || getCurrentWorkspaceId();

	if (!wsId) {
		throw new Error('No workspace ID available');
	}

	return await join(appDataDirPath, 'workspaces', wsId, 'snippets.json');
}

/**
 * Load snippets from file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
export async function loadSnippets(workspaceId = null) {
	try {
		const filePath = await getSnippetsFilePath(workspaceId);
		const content = await tauriFs.readFile(filePath);
		const data = JSON.parse(content);
		snippetsStore.set(data);
		return data;
	} catch (error) {
		console.error('[loadSnippets] Failed to load snippets, using default:', error);
		// Initialize with default if file doesn't exist
		await saveSnippets(workspaceId);
		return defaultSnippets;
	}
}

/**
 * Save snippets to file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
export async function saveSnippets(workspaceId = null) {
	try {
		const filePath = await getSnippetsFilePath(workspaceId);

		// Ensure the workspace directory exists
		const wsId = workspaceId || getCurrentWorkspaceId();
		if (!wsId) {
			throw new Error('No workspace ID available');
		}

		const appDataDirPath = await appDataDir();
		const workspaceDir = await join(appDataDirPath, 'workspaces', wsId);
		const dirExists = await tauriFs.fileExists(workspaceDir);
		if (!dirExists) {
			await tauriFs.createDir(workspaceDir, { recursive: true });
		}

		const data = get(snippetsStore);
		data.metadata.lastModified = new Date().toISOString();
		const content = JSON.stringify(data, null, 2);
		await tauriFs.writeFile(filePath, content);
		return true;
	} catch (error) {
		console.error('Failed to save snippets:', error);
		throw error;
	}
}

// ============================================
// SNIPPET CRUD OPERATIONS
// ============================================

/**
 * Check if a snippet name already exists
 */
export function isSnippetNameDuplicate(name, excludeSnippetId = null) {
	const data = get(snippetsStore);
	return data.snippets.some(s => s.name === name && s.id !== excludeSnippetId);
}

/**
 * Add a new snippet
 */
export async function addSnippet(snippetData) {
	const data = get(snippetsStore);

	const newSnippet = {
		id: crypto.randomUUID(),
		name: snippetData.name,
		command: snippetData.command || '',
		labels: snippetData.labels || [],
		clickCount: 0,
		metadata: {
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	};

	// Create new data object to trigger reactivity
	const updatedData = {
		...data,
		snippets: [...data.snippets, newSnippet]
	};

	snippetsStore.set(updatedData);
	await saveSnippets();

	return newSnippet;
}

/**
 * Update an existing snippet
 */
export async function updateSnippet(snippetId, updates) {
	const data = get(snippetsStore);
	const snippetIndex = data.snippets.findIndex(s => s.id === snippetId);

	if (snippetIndex === -1) {
		throw new Error('Snippet not found');
	}

	const updatedSnippet = {
		...data.snippets[snippetIndex],
		...updates,
		metadata: {
			...data.snippets[snippetIndex].metadata,
			updatedAt: new Date().toISOString()
		}
	};

	// Create new data object to trigger reactivity
	const updatedData = {
		...data,
		snippets: data.snippets.map((s, i) => (i === snippetIndex ? updatedSnippet : s))
	};

	snippetsStore.set(updatedData);
	await saveSnippets();

	return updatedSnippet;
}

/**
 * Delete a snippet
 */
export async function deleteSnippet(snippetId) {
	const data = get(snippetsStore);

	// Create new data object to trigger reactivity
	const updatedData = {
		...data,
		snippets: data.snippets.filter(s => s.id !== snippetId)
	};

	snippetsStore.set(updatedData);
	await saveSnippets();
}

/**
 * Duplicate a snippet with unique name
 */
export async function duplicateSnippet(snippetId) {
	const snippet = getSnippetById(snippetId);
	if (!snippet) {
		throw new Error('Snippet not found');
	}

	// Generate unique name
	let copyNumber = 1;
	let newName = `${snippet.name} (copy)`;
	while (isSnippetNameDuplicate(newName)) {
		copyNumber++;
		newName = `${snippet.name} (copy ${copyNumber})`;
	}

	// Create duplicate
	const duplicateData = {
		...snippet,
		name: newName,
		clickCount: 0,
		metadata: {
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	};

	// Remove ID so addSnippet generates new one
	delete duplicateData.id;

	return await addSnippet(duplicateData);
}

/**
 * Get all snippets
 */
export function getSnippets() {
	const data = get(snippetsStore);
	return data.snippets;
}

/**
 * Get snippet by ID
 */
export function getSnippetById(snippetId) {
	const data = get(snippetsStore);
	return data.snippets.find(s => s.id === snippetId);
}

/**
 * Get all unique tags from all snippets
 */
export function getSnippetTags() {
	const data = get(snippetsStore);
	const allTags = data.snippets.flatMap(s => s.labels || []);
	return [...new Set(allTags)].sort();
}

/**
 * Increment click count for a snippet (when it's used)
 */
export async function incrementSnippetClickCount(snippetId) {
	const data = get(snippetsStore);
	const snippetIndex = data.snippets.findIndex(s => s.id === snippetId);

	if (snippetIndex === -1) {
		return; // Snippet not found, silently ignore
	}

	const updatedSnippet = {
		...data.snippets[snippetIndex],
		clickCount: (data.snippets[snippetIndex].clickCount || 0) + 1
	};

	// Create new data object to trigger reactivity
	const updatedData = {
		...data,
		snippets: data.snippets.map((s, i) => (i === snippetIndex ? updatedSnippet : s))
	};

	snippetsStore.set(updatedData);
	// Save asynchronously without blocking
	saveSnippets().catch(err => console.warn('Failed to save snippet click count:', err));
}
