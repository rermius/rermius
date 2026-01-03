/**
 * Cryptography utilities for encrypting/decrypting sync data
 * Uses Web Crypto API with AES-256-GCM
 */

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - User password
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} Derived encryption key
 */
async function deriveKey(password, salt) {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);

	// Import password as key material
	const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
		'deriveKey'
	]);

	// Derive AES-GCM key from password
	return await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: salt,
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		{
			name: 'AES-GCM',
			length: 256
		},
		false,
		['encrypt', 'decrypt']
	);
}

/**
 * Encrypt data with password
 * @param {Object} data - Data to encrypt (will be JSON stringified)
 * @param {string} password - Encryption password
 * @returns {Promise<string>} Base64 encoded encrypted data with IV and salt
 */
export async function encryptData(data, password) {
	try {
		// Generate random salt and IV
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const iv = crypto.getRandomValues(new Uint8Array(12));

		// Derive key from password
		const key = await deriveKey(password, salt);

		// Convert data to JSON and encode
		const encoder = new TextEncoder();
		const dataBuffer = encoder.encode(JSON.stringify(data));

		// Encrypt data
		const encryptedBuffer = await crypto.subtle.encrypt(
			{
				name: 'AES-GCM',
				iv: iv
			},
			key,
			dataBuffer
		);

		// Combine salt + IV + encrypted data
		const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength);
		combined.set(salt, 0);
		combined.set(iv, salt.length);
		combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

		// Convert to base64
		return btoa(String.fromCharCode(...combined));
	} catch (error) {
		console.error('Encryption failed:', error);
		throw new Error(`Failed to encrypt data: ${error.message}`);
	}
}

/**
 * Decrypt data with password
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} password - Decryption password
 * @returns {Promise<Object>} Decrypted data object
 */
export async function decryptData(encryptedData, password) {
	try {
		// Decode base64
		const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

		// Extract salt, IV, and encrypted data
		const salt = combined.slice(0, 16);
		const iv = combined.slice(16, 28);
		const encrypted = combined.slice(28);

		// Derive key from password
		const key = await deriveKey(password, salt);

		// Decrypt data
		const decryptedBuffer = await crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: iv
			},
			key,
			encrypted
		);

		// Decode and parse JSON
		const decoder = new TextDecoder();
		const jsonString = decoder.decode(decryptedBuffer);
		return JSON.parse(jsonString);
	} catch (error) {
		console.error('Decryption failed:', error);
		throw new Error(`Failed to decrypt data: ${error.message}`);
	}
}
