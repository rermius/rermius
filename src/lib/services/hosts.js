/**
 * Hosts service for managing SSH hosts and groups
 */
import { tauriFs } from './tauri/fs';
import { writable, get } from 'svelte/store';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';
import { getCurrentWorkspaceId } from './workspaces.js';

// Default hosts structure
const defaultHosts = {
	version: '1.0.0',
	metadata: {
		lastModified: new Date().toISOString(),
		lastSync: null,
		deviceId: crypto.randomUUID(),
		encryptionEnabled: false,
		encryptionAlgorithm: null
	},
	groups: [
		{
			id: 'group-default',
			name: 'Default',
			description: 'Default group for SSH hosts',
			icon: 'server-filled',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	],
	hosts: [],
	settings: {
		autoSync: false,
		syncInterval: 300,
		gistId: null,
		encryptBeforeSync: false,
		backupEnabled: true,
		backupCount: 5,
		defaultPort: 22,
		defaultUsername: 'root',
		defaultAuthMethod: 'key',
		defaultConnectionTimeout: 30,
		defaultKeepAlive: true,
		defaultKeepAliveInterval: 60,
		defaultStrictHostKeyChecking: true
	}
};

// Hosts store
export const hostsStore = writable(defaultHosts);

/**
 * Get hosts file path
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
async function getHostsFilePath(workspaceId = null) {
	const appDataDirPath = await appDataDir();
	const wsId = workspaceId || getCurrentWorkspaceId();

	if (!wsId) {
		throw new Error('No workspace ID available');
	}

	return await join(appDataDirPath, 'workspaces', wsId, 'hosts.json');
}

/**
 * Load hosts from file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
export async function loadHosts(workspaceId = null) {
	try {
		const filePath = await getHostsFilePath(workspaceId);
		const content = await tauriFs.readFile(filePath);
		const data = JSON.parse(content);
		hostsStore.set(data);
		return data;
	} catch (error) {
		console.error('[loadHosts] Failed to load hosts, using default:', error);
		// Initialize with default if file doesn't exist
		await saveHosts(workspaceId);
		return defaultHosts;
	}
}

/**
 * Save hosts to file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
export async function saveHosts(workspaceId = null) {
	try {
		const filePath = await getHostsFilePath(workspaceId);

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

		const data = get(hostsStore);
		data.metadata.lastModified = new Date().toISOString();
		const content = JSON.stringify(data, null, 2);
		await tauriFs.writeFile(filePath, content);
		return true;
	} catch (error) {
		console.error('Failed to save hosts:', error);
		throw error;
	}
}

// ============================================
// HOST CRUD OPERATIONS
// ============================================

/**
 * Check if a host label already exists
 */
export function isHostLabelDuplicate(label, excludeHostId = null) {
	const data = get(hostsStore);
	return data.hosts.some(h => h.label === label && h.id !== excludeHostId);
}

/**
 * Add a new host
 */
export async function addHost(hostData) {
	const data = get(hostsStore);
	const settings = data.settings;

	const newHost = {
		id: crypto.randomUUID(),
		label: hostData.label,
		groupId: hostData.groupId || 'group-default',

		// Connection Type
		connectionType: hostData.connectionType || 'ssh',

		// Connection Info
		hostname: hostData.hostname,
		port: hostData.port || settings.defaultPort,
		username: hostData.username || settings.defaultUsername,

		// Authentication
		authMethod: hostData.authMethod || settings.defaultAuthMethod,
		keyId: hostData.keyId || null,
		password: hostData.password || null,

		// Connection Settings
		connectionTimeout: hostData.connectionTimeout || settings.defaultConnectionTimeout,
		keepAlive: hostData.keepAlive ?? settings.defaultKeepAlive,
		keepAliveInterval: hostData.keepAliveInterval || settings.defaultKeepAliveInterval,
		strictHostKeyChecking: hostData.strictHostKeyChecking ?? settings.defaultStrictHostKeyChecking,

		// Advanced Settings
		proxyJump: hostData.proxyJump || null,
		localForwards: hostData.localForwards || [],
		remoteForwards: hostData.remoteForwards || [],
		dynamicForwards: hostData.dynamicForwards || [],

		// Environment & Commands
		environmentVariables: hostData.environmentVariables || {},
		startupCommand: hostData.startupCommand || null,

		// Organization
		tags: hostData.tags || [],
		isFavorite: hostData.isFavorite || false,

		// Metadata
		metadata: {
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			lastConnected: null,
			connectionCount: 0,
			totalUptime: 0
		},

		notes: hostData.notes || ''
	};

	// Create new data object to trigger reactivity
	const updatedData = {
		...data,
		hosts: [...data.hosts, newHost]
	};

	hostsStore.set(updatedData);
	await saveHosts();

	return newHost;
}

/**
 * Update an existing host
 */
export async function updateHost(hostId, updates) {
	const data = get(hostsStore);
	const hostIndex = data.hosts.findIndex(h => h.id === hostId);

	if (hostIndex === -1) {
		throw new Error('Host not found');
	}

	const updatedHost = {
		...data.hosts[hostIndex],
		...updates,
		metadata: {
			...data.hosts[hostIndex].metadata,
			updatedAt: new Date().toISOString()
		}
	};

	// Create new data object to trigger reactivity
	const updatedData = {
		...data,
		hosts: data.hosts.map((h, i) => (i === hostIndex ? updatedHost : h))
	};

	hostsStore.set(updatedData);
	await saveHosts();

	return updatedHost;
}

/**
 * Delete a host
 */
export async function deleteHost(hostId) {
	const data = get(hostsStore);

	// Cleanup: remove hostId from all proxyJump chains
	const cleanedHosts = data.hosts.map(h => {
		if (!h.proxyJump) return h;
		try {
			const chain = JSON.parse(h.proxyJump);
			if (!Array.isArray(chain)) return h;
			const filtered = chain.filter(id => id !== hostId);
			return {
				...h,
				proxyJump: filtered.length > 0 ? JSON.stringify(filtered) : null
			};
		} catch {
			return h;
		}
	});

	// Then filter out the deleted host
	const updatedData = {
		...data,
		hosts: cleanedHosts.filter(h => h.id !== hostId)
	};

	hostsStore.set(updatedData);
	await saveHosts();
}

/**
 * Duplicate a host with unique label
 */
export async function duplicateHost(hostId) {
	const host = getHostById(hostId);
	if (!host) {
		throw new Error('Host not found');
	}

	// Generate unique label
	let copyNumber = 1;
	let newLabel = `${host.label} (copy)`;
	while (isHostLabelDuplicate(newLabel)) {
		copyNumber++;
		newLabel = `${host.label} (copy ${copyNumber})`;
	}

	// Create duplicate with new metadata
	const duplicateData = {
		...host,
		label: newLabel,
		metadata: {
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			lastConnected: null,
			connectionCount: 0,
			totalUptime: 0
		}
	};

	// Remove ID so addHost generates new one
	delete duplicateData.id;

	return await addHost(duplicateData);
}

/**
 * Get all hosts
 */
export function getHosts() {
	const data = get(hostsStore);
	return data.hosts;
}

/**
 * Get hosts by group
 */
export function getHostsByGroup(groupId) {
	const data = get(hostsStore);
	return data.hosts.filter(h => h.groupId === groupId);
}

/**
 * Get host by ID
 */
export function getHostById(hostId) {
	const data = get(hostsStore);
	return data.hosts.find(h => h.id === hostId);
}

// ============================================
// GROUP CRUD OPERATIONS
// ============================================

/**
 * Check if a group name already exists
 */
export function isGroupNameDuplicate(name, excludeGroupId = null) {
	const data = get(hostsStore);
	return data.groups.some(g => g.name === name && g.id !== excludeGroupId);
}

/**
 * Get all groups
 */
export function getGroups() {
	const data = get(hostsStore);
	return data.groups;
}

/**
 * Add a new group
 */
export async function addGroup(groupData) {
	const data = get(hostsStore);

	const newGroup = {
		id: crypto.randomUUID(),
		name: groupData.name,
		description: groupData.description || '',
		icon: groupData.icon || 'server-filled',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	data.groups.push(newGroup);
	hostsStore.set(data);
	await saveHosts();

	return newGroup;
}

/**
 * Update an existing group
 */
export async function updateGroup(groupId, updates) {
	const data = get(hostsStore);
	const groupIndex = data.groups.findIndex(g => g.id === groupId);

	if (groupIndex === -1) {
		throw new Error('Group not found');
	}

	data.groups[groupIndex] = {
		...data.groups[groupIndex],
		...updates,
		updatedAt: new Date().toISOString()
	};

	hostsStore.set(data);
	await saveHosts();

	return data.groups[groupIndex];
}

/**
 * Delete a group
 */
export async function deleteGroup(groupId) {
	const data = get(hostsStore);

	// Don't allow deleting if it's the only group
	if (data.groups.length <= 1) {
		throw new Error('Cannot delete the last group');
	}

	// Find first alternative group to move hosts to
	const alternativeGroup = data.groups.find(g => g.id !== groupId);

	if (!alternativeGroup) {
		throw new Error('Cannot delete group: no alternative group available');
	}

	// Move hosts in this group to alternative group
	data.hosts = data.hosts.map(h => {
		if (h.groupId === groupId) {
			return { ...h, groupId: alternativeGroup.id };
		}
		return h;
	});

	// Remove the group
	data.groups = data.groups.filter(g => g.id !== groupId);
	hostsStore.set(data);
	await saveHosts();
}

/**
 * Get group by ID
 */
export function getGroupById(groupId) {
	const data = get(hostsStore);
	return data.groups.find(g => g.id === groupId);
}

/**
 * Get all unique tags from all hosts
 */
export function getHostTags() {
	const data = get(hostsStore);
	const allTags = data.hosts.flatMap(h => h.tags || []);
	return [...new Set(allTags)].sort();
}
