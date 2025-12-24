/**
 * Keychain service for managing SSH keys
 */
import { tauriFs } from './tauri/fs';
import { writable, get } from 'svelte/store';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';
import { getCurrentWorkspaceId } from './workspaces.js';

/**
 * Detect SSH key type from private key content
 * @param {string} privateKey - Private key content
 * @returns {string} Key type (RSA, ED25519, ECDSA, DSA, PKCS8, OpenSSH, Unknown)
 */
function detectKeyType(privateKey) {
	if (!privateKey || typeof privateKey !== 'string') {
		return 'Unknown';
	}

	if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
		return 'RSA';
	} else if (privateKey.includes('BEGIN OPENSSH PRIVATE KEY')) {
		// OpenSSH format - need to check the content for actual type
		if (privateKey.includes('ssh-ed25519')) {
			return 'ED25519';
		} else if (privateKey.includes('ecdsa-sha2')) {
			return 'ECDSA';
		} else if (privateKey.includes('ssh-rsa')) {
			return 'RSA';
		}
		return 'OpenSSH';
	} else if (privateKey.includes('BEGIN EC PRIVATE KEY')) {
		return 'ECDSA';
	} else if (privateKey.includes('BEGIN DSA PRIVATE KEY')) {
		return 'DSA';
	} else if (privateKey.includes('BEGIN PRIVATE KEY')) {
		return 'PKCS8';
	}
	return 'Unknown';
}

/**
 * Generate label from file path
 * @param {string} filePath - File path
 * @returns {string} Generated label
 */
function generateLabelFromPath(filePath) {
	const fileName = filePath.split(/[\\/]/).pop();
	return fileName.replace(/\.(pem|key|ssh|rsa|ed25519|ecdsa)$/, '');
}

// Default keychain structure
const defaultKeychain = {
	version: '1.0.0',
	metadata: {
		lastModified: new Date().toISOString(),
		lastSync: null,
		deviceId: crypto.randomUUID(),
		encryptionEnabled: false,
		encryptionAlgorithm: null
	},
	vaults: [
		{
			id: 'vault-default',
			name: 'Default',
			description: 'Default vault for SSH keys',
			color: '#4A9FFF',
			icon: 'key-filled',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	],
	keys: [],
	settings: {
		autoSync: false,
		syncInterval: 300,
		gistId: null,
		encryptBeforeSync: false,
		backupEnabled: true,
		backupCount: 5
	}
};

// Keychain store
export const keychainStore = writable(defaultKeychain);

/**
 * Get keychain file path
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
async function getKeychainFilePath(workspaceId = null) {
	const appDataDirPath = await appDataDir();
	const wsId = workspaceId || getCurrentWorkspaceId();

	if (!wsId) {
		throw new Error('No workspace ID available');
	}

	return await join(appDataDirPath, 'workspaces', wsId, 'keychain.json');
}

/**
 * Load keychain from file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
export async function loadKeychain(workspaceId = null) {
	try {
		const filePath = await getKeychainFilePath(workspaceId);
		const content = await tauriFs.readFile(filePath);
		const data = JSON.parse(content);
		keychainStore.set(data);
		return data;
	} catch (error) {
		console.error('[loadKeychain] Failed to load keychain, using default:', error);
		// Initialize with default if file doesn't exist
		await saveKeychain(workspaceId);
		return defaultKeychain;
	}
}

/**
 * Save keychain to file
 * @param {string} workspaceId - Optional workspace ID (uses current if not provided)
 */
export async function saveKeychain(workspaceId = null) {
	try {
		const filePath = await getKeychainFilePath(workspaceId);

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

		const data = get(keychainStore);
		data.metadata.lastModified = new Date().toISOString();
		const content = JSON.stringify(data, null, 2);
		await tauriFs.writeFile(filePath, content);
		return true;
	} catch (error) {
		console.error('Failed to save keychain:', error);
		throw error;
	}
}

/**
 * Check if a label already exists
 */
export function isLabelDuplicate(label, excludeKeyId = null) {
	const keychain = get(keychainStore);
	return keychain.keys.some(k => k.label === label && k.id !== excludeKeyId);
}

/**
 * Check if a key already exists (by fingerprint or private key content)
 */
export function isKeyDuplicate(privateKey, publicKey, excludeKeyId = null) {
	const keychain = get(keychainStore);
	const fingerprint = generateFingerprint(publicKey);

	return keychain.keys.some(k => {
		// Exclude the current key if specified
		if (excludeKeyId && k.id === excludeKeyId) {
			return false;
		}
		// Check by fingerprint if available
		if (fingerprint && k.fingerprint === fingerprint) {
			return true;
		}
		// Check by private key content
		if (k.privateKey === privateKey) {
			return true;
		}
		return false;
	});
}

/**
 * Find duplicate key
 */
export function findDuplicateKey(privateKey, publicKey, excludeKeyId = null) {
	const keychain = get(keychainStore);
	const fingerprint = generateFingerprint(publicKey);

	return keychain.keys.find(k => {
		// Exclude the current key if specified
		if (excludeKeyId && k.id === excludeKeyId) {
			return false;
		}
		if (fingerprint && k.fingerprint === fingerprint) {
			return true;
		}
		if (k.privateKey === privateKey) {
			return true;
		}
		return false;
	});
}

/**
 * Import SSH key from file path
 * This is a reusable function that can be used from anywhere
 * @param {string} filePath - Path to the private key file
 * @param {Object} options - Import options
 * @param {string} [options.label] - Custom label (auto-generated from filename if not provided)
 * @param {boolean} [options.skipDuplicate=false] - If true, return duplicate info instead of throwing
 * @returns {Promise<Object>} Import result with status and key info
 * @returns {Promise<Object.status>} 'imported' | 'duplicate' | 'error'
 * @returns {Promise<Object.key>} Imported key object (if successful)
 * @returns {Promise<Object.duplicateKey>} Duplicate key object (if duplicate)
 * @returns {Promise<Object.error>} Error message (if error)
 */
export async function importKeyFromFile(filePath, options = {}) {
	const { label: customLabel, skipDuplicate = false } = options;

	try {
		// Read private key
		const privateKeyContent = await tauriFs.readFile(filePath);

		// Detect key type
		const keyType = detectKeyType(privateKeyContent);

		// Try to read public key
		let publicKeyContent = '';
		try {
			const pubKeyPath = filePath + '.pub';
			const pubKeyExists = await tauriFs.fileExists(pubKeyPath);
			if (pubKeyExists) {
				publicKeyContent = await tauriFs.readFile(pubKeyPath);
			}
		} catch (pubKeyError) {
			// Silently skip if public key doesn't exist
		}

		// Generate label from filename if not provided
		const label = customLabel || generateLabelFromPath(filePath);

		// Check for duplicate
		const duplicateKey = findDuplicateKey(privateKeyContent, publicKeyContent);
		if (duplicateKey) {
			if (skipDuplicate) {
				return {
					status: 'duplicate',
					duplicateKey,
					keyType
				};
			}
			throw new Error(`This key already exists with label "${duplicateKey.label}"`);
		}

		// Add key
		const newKey = await addKey({
			label,
			privateKey: privateKeyContent,
			publicKey: publicKeyContent,
			keyType
		});

		return {
			status: 'imported',
			key: newKey,
			keyType
		};
	} catch (error) {
		return {
			status: 'error',
			error: error.message || String(error),
			keyType: null
		};
	}
}

/**
 * Add a new key to the keychain
 */
export async function addKey(keyData) {
	const keychain = get(keychainStore);

	// Check for duplicate label
	if (isLabelDuplicate(keyData.label)) {
		throw new Error(`A key with label "${keyData.label}" already exists`);
	}

	// Check for duplicate key
	if (isKeyDuplicate(keyData.privateKey, keyData.publicKey)) {
		const duplicate = findDuplicateKey(keyData.privateKey, keyData.publicKey);
		throw new Error(`This key already exists with label "${duplicate.label}"`);
	}

	const newKey = {
		id: crypto.randomUUID(),
		label: keyData.label,
		keyType: keyData.keyType || 'Unknown',
		vaultId: keyData.vaultId || 'vault-default',
		privateKey: keyData.privateKey,
		publicKey: keyData.publicKey || '',
		certificate: keyData.certificate || null,
		fingerprint: generateFingerprint(keyData.publicKey),
		keySize: detectKeySize(keyData.privateKey, keyData.keyType),
		tags: keyData.tags || [],
		metadata: {
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			lastUsed: null,
			usageCount: 0
		},
		isEncrypted: false,
		notes: keyData.notes || ''
	};

	// Create new keychain object to trigger reactivity
	const updatedKeychain = {
		...keychain,
		keys: [...keychain.keys, newKey],
		metadata: {
			...keychain.metadata,
			lastModified: new Date().toISOString()
		}
	};

	keychainStore.set(updatedKeychain);
	await saveKeychain();

	return newKey;
}

/**
 * Update an existing key
 */
export async function updateKey(keyId, updates) {
	const keychain = get(keychainStore);
	const keyIndex = keychain.keys.findIndex(k => k.id === keyId);

	if (keyIndex === -1) {
		throw new Error('Key not found');
	}

	const updatedKey = {
		...keychain.keys[keyIndex],
		...updates,
		metadata: {
			...keychain.keys[keyIndex].metadata,
			updatedAt: new Date().toISOString()
		}
	};

	// Create new keychain object to trigger reactivity
	const updatedKeychain = {
		...keychain,
		keys: keychain.keys.map((k, i) => (i === keyIndex ? updatedKey : k)),
		metadata: {
			...keychain.metadata,
			lastModified: new Date().toISOString()
		}
	};

	keychainStore.set(updatedKeychain);
	await saveKeychain();

	return updatedKey;
}

/**
 * Delete a key from the keychain
 */
export async function deleteKey(keyId) {
	const keychain = get(keychainStore);

	// Create new keychain object to trigger reactivity
	const updatedKeychain = {
		...keychain,
		keys: keychain.keys.filter(k => k.id !== keyId),
		metadata: {
			...keychain.metadata,
			lastModified: new Date().toISOString()
		}
	};

	keychainStore.set(updatedKeychain);
	await saveKeychain();
}

/**
 * Get all keys
 */
export function getKeys() {
	const keychain = get(keychainStore);
	return keychain.keys;
}

/**
 * Get a specific key by ID
 */
export function getKey(keyId) {
	const keychain = get(keychainStore);
	return keychain.keys.find(k => k.id === keyId);
}

/**
 * Get keys by vault
 */
export function getKeysByVault(vaultId) {
	const keychain = get(keychainStore);
	return keychain.keys.filter(k => k.vaultId === vaultId);
}

/**
 * Get all vaults
 */
export function getVaults() {
	const keychain = get(keychainStore);
	return keychain.vaults;
}

/**
 * Generate fingerprint from public key (simplified)
 */
function generateFingerprint(publicKey) {
	if (!publicKey) return null;
	// This is a simplified version - in production, use proper crypto
	const hash = btoa(publicKey).substring(0, 32);
	return `SHA256:${hash}`;
}

/**
 * Detect key size from private key content
 */
function detectKeySize(privateKey, keyType) {
	if (keyType === 'RSA') {
		// Try to detect RSA key size from content
		if (privateKey.includes('4096')) return 4096;
		if (privateKey.includes('2048')) return 2048;
		return 2048; // default
	} else if (keyType === 'ED25519') {
		return 256;
	} else if (keyType === 'ECDSA') {
		return 256;
	}
	return null;
}
