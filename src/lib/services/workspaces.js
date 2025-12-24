/**
 * Workspace Service
 * Manages workspace CRUD operations, directory management, and avatar handling
 *
 * Each workspace has isolated data stored in its own directory:
 * - appDataDir/workspaces/{workspaceId}/hosts.json
 * - appDataDir/workspaces/{workspaceId}/keychain.json
 * - appDataDir/workspaces/{workspaceId}/snippets.json
 * - etc.
 */

import { get } from 'svelte/store';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';
import { tauriFs } from './tauri/fs.js';
import { localStorage } from './storage/index.js';
import { STORAGE_KEYS, FILE_PATHS } from '$lib/constants/storage-keys.js';

// Workspace store will be imported after it's created
let workspacesStoreInstance = null;

/**
 * Set workspace store instance (called after store is created to avoid circular dependency)
 */
export function setWorkspacesStore(store) {
	workspacesStoreInstance = store;
}

// Default workspace data structure
const defaultWorkspaces = {
	version: '1.0.0',
	metadata: {
		lastModified: new Date().toISOString(),
		currentWorkspaceId: null
	},
	workspaces: []
};

/**
 * Get workspaces file path
 */
async function getWorkspacesFilePath() {
	const appDataDirPath = await appDataDir();
	return await join(appDataDirPath, FILE_PATHS.WORKSPACES);
}

/**
 * Get workspace directory path
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<string>} Full path to workspace directory
 */
export async function getWorkspaceDataPath(workspaceId) {
	const appDataDirPath = await appDataDir();
	return await join(appDataDirPath, FILE_PATHS.WORKSPACES_DATA_DIR, workspaceId);
}

/**
 * Get workspace avatars directory path
 */
async function getAvatarsDirectoryPath() {
	const appDataDirPath = await appDataDir();
	return await join(appDataDirPath, FILE_PATHS.WORKSPACE_AVATARS_DIR);
}

/**
 * Get workspace avatar file path
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<string>} Full path to avatar file
 */
export async function getWorkspaceAvatarPath(workspaceId) {
	const avatarsDir = await getAvatarsDirectoryPath();
	return await join(avatarsDir, `${workspaceId}.png`);
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Load workspaces from file
 * @returns {Promise<Object>} Workspaces data
 */
export async function loadWorkspaces() {
	try {
		const filePath = await getWorkspacesFilePath();
		const content = await tauriFs.readFile(filePath);
		const data = JSON.parse(content);

		// Update store if available
		if (workspacesStoreInstance) {
			workspacesStoreInstance.setWorkspaces(data.workspaces);
			if (data.metadata.currentWorkspaceId) {
				workspacesStoreInstance.setCurrentWorkspace(data.metadata.currentWorkspaceId);
			}
		}

		return data;
	} catch (error) {
		console.warn('[workspaces] Failed to load workspaces, using defaults:', error);
		// Initialize with defaults if file doesn't exist
		await saveWorkspaces();
		return defaultWorkspaces;
	}
}

/**
 * Save workspaces to file
 * @returns {Promise<boolean>} Success status
 */
export async function saveWorkspaces() {
	try {
		const filePath = await getWorkspacesFilePath();

		// Ensure parent directory exists
		const appDataDirPath = await appDataDir();
		const dirExists = await tauriFs.fileExists(appDataDirPath);
		if (!dirExists) {
			await tauriFs.createDir(appDataDirPath, { recursive: true });
		}

		// Get current data from store or use defaults
		let data = defaultWorkspaces;
		if (workspacesStoreInstance) {
			const storeData = get(workspacesStoreInstance);
			data = {
				version: '1.0.0',
				metadata: {
					lastModified: new Date().toISOString(),
					currentWorkspaceId: storeData.currentWorkspaceId
				},
				workspaces: storeData.workspaces
			};
		}

		const content = JSON.stringify(data, null, 2);
		await tauriFs.writeFile(filePath, content);
		return true;
	} catch (error) {
		console.error('[workspaces] Failed to save workspaces:', error);
		throw error;
	}
}

/**
 * Add a new workspace
 * @param {Object} workspaceData - Workspace data (name, avatarFile)
 * @returns {Promise<Object>} Created workspace object
 */
export async function addWorkspace(workspaceData) {
	const { name, avatarFile = null } = workspaceData;

	// Generate unique ID
	const workspaceId = crypto.randomUUID();

	// Create workspace object
	const workspace = {
		id: workspaceId,
		name: name.trim(),
		avatarPath: null,
		isDefault: false,
		color: generateWorkspaceColor(),
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	// Create workspace directory
	await createWorkspaceDirectory(workspaceId);

	// Save avatar if provided
	if (avatarFile) {
		const avatarPath = await saveWorkspaceAvatar(workspaceId, avatarFile);
		workspace.avatarPath = avatarPath;
	}

	// Add to store
	if (workspacesStoreInstance) {
		workspacesStoreInstance.addWorkspace(workspace);

		// If this is the first workspace, mark as default and set as current
		const storeData = get(workspacesStoreInstance);
		if (storeData.workspaces.length === 1) {
			workspace.isDefault = true;
			workspacesStoreInstance.setCurrentWorkspace(workspaceId);
		}
	}

	// Save to file
	await saveWorkspaces();

	return workspace;
}

/**
 * Update an existing workspace
 * @param {string} workspaceId - Workspace ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated workspace object
 */
export async function updateWorkspace(workspaceId, updates) {
	console.log('[updateWorkspace] Updating workspace:', workspaceId, updates);

	if (!workspacesStoreInstance) {
		throw new Error('Workspace store not initialized');
	}

	const storeData = get(workspacesStoreInstance);
	const workspace = storeData.workspaces.find(w => w.id === workspaceId);

	if (!workspace) {
		throw new Error(`Workspace not found: ${workspaceId}`);
	}

	// Prepare update object - only include fields that are actually being updated
	const updateData = {};

	// Handle name update
	if (updates.name !== undefined) {
		updateData.name = updates.name.trim();
		console.log('[updateWorkspace] Updating name:', updateData.name);
	}

	// Handle avatar update separately
	if (updates.avatarFile !== undefined) {
		if (updates.avatarFile === null) {
			// Delete avatar
			await deleteWorkspaceAvatar(workspaceId);
			updateData.avatarPath = null;
		} else if (updates.avatarFile instanceof File) {
			// Save new avatar (File object)
			const avatarPath = await saveWorkspaceAvatar(workspaceId, updates.avatarFile);
			updateData.avatarPath = avatarPath;
		}
		// If avatarFile is a string (existing path), don't update (no change)
	}

	// Handle color update
	if (updates.color !== undefined) {
		updateData.color = updates.color;
		console.log('[updateWorkspace] Updating color:', updateData.color);
	}

	// Only update if there are actual changes
	if (Object.keys(updateData).length === 0) {
		console.log('[updateWorkspace] No changes to update');
		return workspace;
	}

	// Update workspace
	const updatedWorkspace = {
		...workspace,
		...updateData,
		updatedAt: new Date().toISOString()
	};

	console.log('[updateWorkspace] Updated workspace:', updatedWorkspace);

	// Update store
	workspacesStoreInstance.updateWorkspace(workspaceId, updatedWorkspace);

	// Save to file
	await saveWorkspaces();

	console.log('[updateWorkspace] ✓ Workspace updated successfully');
	return updatedWorkspace;
}

/**
 * Delete a workspace
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteWorkspace(workspaceId) {
	if (!workspacesStoreInstance) {
		throw new Error('Workspace store not initialized');
	}

	const storeData = get(workspacesStoreInstance);

	// Validate not last workspace
	if (storeData.workspaces.length <= 1) {
		throw new Error('Cannot delete the last workspace');
	}

	// Get workspace
	const workspace = storeData.workspaces.find(w => w.id === workspaceId);
	if (!workspace) {
		throw new Error(`Workspace not found: ${workspaceId}`);
	}

	// If current workspace, switch to another first
	if (storeData.currentWorkspaceId === workspaceId) {
		const nextWorkspace = storeData.workspaces.find(w => w.id !== workspaceId);
		if (nextWorkspace) {
			// Note: switchWorkspace will be implemented in Phase 3
			// For now, just set the current workspace
			workspacesStoreInstance.setCurrentWorkspace(nextWorkspace.id);
		}
	}

	// Delete avatar
	if (workspace.avatarPath) {
		await deleteWorkspaceAvatar(workspaceId);
	}

	// Delete workspace directory and all files
	await deleteWorkspaceDirectory(workspaceId);

	// Remove from store
	workspacesStoreInstance.removeWorkspace(workspaceId);

	// Save to file
	await saveWorkspaces();

	return true;
}

/**
 * Get all workspaces
 * @returns {Array<Object>} Array of workspace objects
 */
export function getWorkspaces() {
	if (!workspacesStoreInstance) {
		return [];
	}
	const storeData = get(workspacesStoreInstance);
	return storeData.workspaces;
}

/**
 * Get workspace by ID
 * @param {string} workspaceId - Workspace ID
 * @returns {Object|null} Workspace object or null
 */
export function getWorkspaceById(workspaceId) {
	const workspaces = getWorkspaces();
	return workspaces.find(w => w.id === workspaceId) || null;
}

/**
 * Get current workspace ID
 * @returns {string|null} Current workspace ID
 */
export function getCurrentWorkspaceId() {
	// Try localStorage first (for quick access)
	const storedId = localStorage.get(STORAGE_KEYS.CURRENT_WORKSPACE_ID);
	if (storedId) {
		return storedId;
	}

	// Fallback to store
	if (workspacesStoreInstance) {
		const storeData = get(workspacesStoreInstance);
		return storeData.currentWorkspaceId;
	}

	return null;
}

/**
 * Set current workspace
 * @param {string} workspaceId - Workspace ID
 */
export async function setCurrentWorkspace(workspaceId) {
	console.log('[setCurrentWorkspace] Setting current workspace:', workspaceId);

	// Update localStorage for quick access
	localStorage.set(STORAGE_KEYS.CURRENT_WORKSPACE_ID, workspaceId);
	console.log('[setCurrentWorkspace] ✓ Updated localStorage');

	// Update store
	if (workspacesStoreInstance) {
		workspacesStoreInstance.setCurrentWorkspace(workspaceId);
		console.log('[setCurrentWorkspace] ✓ Updated store');
	} else {
		console.warn('[setCurrentWorkspace] Workspace store instance not available');
	}

	// Save to file
	await saveWorkspaces();
	console.log('[setCurrentWorkspace] ✓ Saved to file');
	console.log('[setCurrentWorkspace] Current workspace set successfully');
}

/**
 * Check if workspace name is duplicate
 * @param {string} name - Workspace name to check
 * @param {string} [excludeId] - Workspace ID to exclude from check (for edit mode)
 * @returns {boolean} True if duplicate
 */
export function isWorkspaceNameDuplicate(name, excludeId = null) {
	const workspaces = getWorkspaces();
	const normalizedName = name.trim().toLowerCase();
	return workspaces.some(w => w.name.trim().toLowerCase() === normalizedName && w.id !== excludeId);
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Create workspace directory with initial empty files
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<string>} Path to created directory
 */
export async function createWorkspaceDirectory(workspaceId) {
	const workspacePath = await getWorkspaceDataPath(workspaceId);

	// Create directory
	await tauriFs.createDir(workspacePath, { recursive: true });

	// Create empty data files
	const emptyData = {
		version: '1.0.0',
		metadata: {
			lastModified: new Date().toISOString()
		}
	};

	const files = [
		{ name: 'hosts.json', data: { ...emptyData, groups: [], hosts: [], settings: {} } },
		{ name: 'keychain.json', data: { ...emptyData, keys: [] } },
		{ name: 'snippets.json', data: { ...emptyData, snippets: [] } },
		{ name: 'app-settings.json', data: emptyData },
		{ name: 'sync-settings.json', data: emptyData }
	];

	for (const file of files) {
		const filePath = await join(workspacePath, file.name);
		await tauriFs.writeFile(filePath, JSON.stringify(file.data, null, 2));
	}

	return workspacePath;
}

/**
 * Delete workspace directory and all files
 * @param {string} workspaceId - Workspace ID
 */
export async function deleteWorkspaceDirectory(workspaceId) {
	try {
		const workspacePath = await getWorkspaceDataPath(workspaceId);
		const exists = await tauriFs.fileExists(workspacePath);

		if (exists) {
			await tauriFs.removeDir(workspacePath, { recursive: true });
		}
	} catch (error) {
		console.error('[workspaces] Failed to delete workspace directory:', error);
		throw error;
	}
}

// ============================================================================
// Avatar Management
// ============================================================================

/**
 * Save workspace avatar
 * @param {string} workspaceId - Workspace ID
 * @param {File} imageFile - Image file to save
 * @returns {Promise<string>} Relative path to saved avatar
 */
export async function saveWorkspaceAvatar(workspaceId, imageFile) {
	const { processAvatarFile } = await import('$lib/utils/avatar-handler.js');

	const result = await processAvatarFile(workspaceId, imageFile);

	if (!result.success) {
		throw new Error(result.error || 'Failed to save avatar');
	}

	return result.path;
}

/**
 * Delete workspace avatar
 * @param {string} workspaceId - Workspace ID
 */
export async function deleteWorkspaceAvatar(workspaceId) {
	const { deleteAvatarFromFileSystem } = await import('$lib/utils/avatar-handler.js');
	await deleteAvatarFromFileSystem(workspaceId);
}

// ============================================================================
// First Launch Detection
// ============================================================================

/**
 * Check if this is first launch (no workspaces exist)
 * @returns {Promise<boolean>} True if first launch
 */
export async function isFirstLaunch() {
	try {
		const filePath = await getWorkspacesFilePath();
		const exists = await tauriFs.fileExists(filePath);
		return !exists;
	} catch (error) {
		return true; // Assume first launch on error
	}
}

/**
 * Create default workspace
 * @returns {Promise<Object>} Created workspace object
 */
export async function createDefaultWorkspace() {
	return await addWorkspace({
		name: 'Default',
		avatarFile: null
	});
}

// ============================================================================
// Workspace Switching
// ============================================================================

/**
 * Switch to a different workspace
 * @param {string} targetWorkspaceId - Target workspace ID
 * @returns {Promise<boolean>} Success status
 */
export async function switchWorkspace(targetWorkspaceId) {
	console.log('[switchWorkspace] ===== START SWITCH WORKSPACE =====');
	console.log('[switchWorkspace] Target workspace ID:', targetWorkspaceId);

	try {
		// Get current workspace ID for comparison
		const currentWorkspaceId = getCurrentWorkspaceId();
		console.log('[switchWorkspace] Current workspace ID:', currentWorkspaceId);

		if (targetWorkspaceId === currentWorkspaceId) {
			console.log('[switchWorkspace] Already on target workspace, skipping switch');
			return true;
		}

		// Validate target workspace exists
		if (!workspacesStoreInstance) {
			throw new Error('Workspace store not initialized');
		}

		const storeData = get(workspacesStoreInstance);
		const targetWorkspace = storeData.workspaces.find(w => w.id === targetWorkspaceId);

		if (!targetWorkspace) {
			throw new Error(`Workspace with ID ${targetWorkspaceId} not found`);
		}

		console.log('[switchWorkspace] Target workspace found:', targetWorkspace.name);
		console.log('[switchWorkspace] Loading workspace data...');

		// Import load functions dynamically to avoid circular dependencies
		const { loadKeychain } = await import('./keychain.js');
		const { loadHosts } = await import('./hosts.js');
		const { loadSyncSettings } = await import('./sync-settings.js');
		const { loadSnippets } = await import('./snippets.js');
		const { loadSettings } = await import('./app-settings.js');

		// Load all workspace-specific data
		console.log('[switchWorkspace] Loading keychain...');
		await loadKeychain(targetWorkspaceId);
		console.log('[switchWorkspace] ✓ Keychain loaded');

		console.log('[switchWorkspace] Loading hosts...');
		await loadHosts(targetWorkspaceId);
		console.log('[switchWorkspace] ✓ Hosts loaded');

		console.log('[switchWorkspace] Loading sync settings...');
		await loadSyncSettings(targetWorkspaceId);
		console.log('[switchWorkspace] ✓ Sync settings loaded');

		console.log('[switchWorkspace] Loading snippets...');
		await loadSnippets(targetWorkspaceId);
		console.log('[switchWorkspace] ✓ Snippets loaded');

		console.log('[switchWorkspace] Loading app settings...');
		await loadSettings(targetWorkspaceId);
		console.log('[switchWorkspace] ✓ App settings loaded');

		// Set current workspace after data is loaded
		console.log('[switchWorkspace] Setting current workspace...');
		await setCurrentWorkspace(targetWorkspaceId);
		console.log('[switchWorkspace] ✓ Current workspace set');

		console.log('[switchWorkspace] ===== SWITCH COMPLETE =====');
		return true;
	} catch (error) {
		console.error('[switchWorkspace] ===== SWITCH FAILED =====');
		console.error('[switchWorkspace] Error:', error);
		console.error('[switchWorkspace] Stack:', error.stack);
		throw error;
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a random color for workspace
 * @returns {string} Hex color code
 */
function generateWorkspaceColor() {
	const colors = [
		'#4A9FFF', // Blue
		'#7C3AED', // Purple
		'#10B981', // Green
		'#F59E0B', // Orange
		'#EF4444', // Red
		'#EC4899', // Pink
		'#14B8A6', // Teal
		'#8B5CF6', // Violet
		'#F97316', // Deep Orange
		'#06B6D4', // Cyan
		'#84CC16', // Lime
		'#F43F5E' // Rose
	];
	return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Generate workspace initials from name
 * @param {string} name - Workspace name
 * @returns {string} Two-letter initials
 */
export function getWorkspaceInitials(name) {
	if (!name) return 'WS';

	const words = name.trim().split(/\s+/);
	if (words.length >= 2) {
		return (words[0][0] + words[1][0]).toUpperCase();
	}

	return name.substring(0, 2).toUpperCase();
}
