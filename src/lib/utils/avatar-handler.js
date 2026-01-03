/**
 * Avatar Handler Utility
 * Handles avatar image processing, validation, and filesystem operations
 */

import { tauriFs } from '$lib/services';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';

// Validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MIN_DIMENSIONS = 64;
const TARGET_SIZE = 256;

/**
 * Validate image file
 * @param {File} file - Image file to validate
 * @returns {Promise<string|null>} Error message or null if valid
 */
export async function validateImageFile(file) {
	// Check if file exists
	if (!file) {
		return 'No file provided';
	}

	// Check file size
	if (file.size > MAX_FILE_SIZE) {
		return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`;
	}

	// Check file type
	if (!ALLOWED_TYPES.includes(file.type)) {
		return 'File type must be PNG, JPEG, or WebP';
	}

	// Check image dimensions
	try {
		const dimensions = await getImageDimensions(file);
		if (dimensions.width < MIN_DIMENSIONS || dimensions.height < MIN_DIMENSIONS) {
			return `Image dimensions must be at least ${MIN_DIMENSIONS}x${MIN_DIMENSIONS}px`;
		}
	} catch (error) {
		return 'Failed to read image file';
	}

	return null; // Valid
}

/**
 * Get image dimensions from file
 * @param {File} file - Image file
 * @returns {Promise<{width: number, height: number}>} Image dimensions
 */
function getImageDimensions(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = e => {
			const img = new Image();

			img.onload = () => {
				resolve({ width: img.width, height: img.height });
			};

			img.onerror = () => {
				reject(new Error('Failed to load image'));
			};

			img.src = e.target.result;
		};

		reader.onerror = () => {
			reject(new Error('Failed to read file'));
		};

		reader.readAsDataURL(file);
	});
}

/**
 * Resize image to target size with center crop
 * @param {File} file - Image file to resize
 * @param {number} targetSize - Target size in pixels (square)
 * @returns {Promise<Blob>} Resized image blob
 */
export async function resizeImage(file, targetSize = TARGET_SIZE) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = e => {
			const img = new Image();

			img.onload = () => {
				// Create canvas
				const canvas = document.createElement('canvas');
				canvas.width = targetSize;
				canvas.height = targetSize;
				const ctx = canvas.getContext('2d');

				// Calculate center crop dimensions
				const { width, height } = img;
				const size = Math.min(width, height);
				const x = (width - size) / 2;
				const y = (height - size) / 2;

				// Draw image with center crop
				ctx.drawImage(
					img,
					x,
					y,
					size,
					size, // Source (crop from center)
					0,
					0,
					targetSize,
					targetSize // Destination (fit to canvas)
				);

				// Convert canvas to blob
				canvas.toBlob(
					blob => {
						if (blob) {
							resolve(blob);
						} else {
							reject(new Error('Failed to create image blob'));
						}
					},
					'image/png',
					0.95 // Quality
				);
			};

			img.onerror = () => {
				reject(new Error('Failed to load image'));
			};

			img.src = e.target.result;
		};

		reader.onerror = () => {
			reject(new Error('Failed to read file'));
		};

		reader.readAsDataURL(file);
	});
}

/**
 * Save avatar to filesystem
 * @param {string} workspaceId - Workspace ID
 * @param {Blob} imageBlob - Image blob to save
 * @returns {Promise<string>} Relative path to saved avatar
 */
export async function saveAvatarToFileSystem(workspaceId, imageBlob) {
	try {
		// Get avatars directory path
		const appDataDirPath = await appDataDir();
		const avatarsDir = await join(appDataDirPath, 'workspace-avatars');

		// Ensure avatars directory exists
		const dirExists = await tauriFs.fileExists(avatarsDir);
		if (!dirExists) {
			await tauriFs.createDir(avatarsDir, { recursive: true });
		}

		// Get avatar file path
		const avatarFileName = `${workspaceId}.png`;
		const avatarPath = await join(avatarsDir, avatarFileName);

		// Convert blob to array buffer
		const arrayBuffer = await imageBlob.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);

		// Write file
		await tauriFs.writeBinaryFile(avatarPath, uint8Array);

		// Return relative path
		return `workspace-avatars/${avatarFileName}`;
	} catch (error) {
		console.error('[avatar-handler] Failed to save avatar:', error);
		throw new Error('Failed to save avatar to filesystem');
	}
}

/**
 * Delete avatar from filesystem
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<void>}
 */
export async function deleteAvatarFromFileSystem(workspaceId) {
	try {
		const appDataDirPath = await appDataDir();
		const avatarPath = await join(appDataDirPath, 'workspace-avatars', `${workspaceId}.png`);

		const exists = await tauriFs.fileExists(avatarPath);
		if (exists) {
			await tauriFs.remove(avatarPath);
		}
	} catch (error) {
		console.error('[avatar-handler] Failed to delete avatar:', error);
		throw error; // Throw to ensure caller knows deletion failed
	}
}

/**
 * Load avatar as data URL for display
 * @param {string} avatarPath - Relative avatar path
 * @returns {Promise<string>} Data URL for image
 */
export async function loadAvatarAsDataUrl(avatarPath) {
	try {
		const appDataDirPath = await appDataDir();
		const fullPath = await join(appDataDirPath, avatarPath);

		// Check if file exists
		const exists = await tauriFs.fileExists(fullPath);
		if (!exists) {
			throw new Error('Avatar file not found');
		}

		// Read file as binary
		const uint8Array = await tauriFs.readBinaryFile(fullPath);

		// Convert to base64
		const base64 = btoa(
			Array.from(uint8Array)
				.map(byte => String.fromCharCode(byte))
				.join('')
		);

		// Return data URL
		return `data:image/png;base64,${base64}`;
	} catch (error) {
		console.error('[avatar-handler] Failed to load avatar:', error);
		throw new Error('Failed to load avatar from filesystem');
	}
}

/**
 * Process avatar file: validate, resize, and save
 * @param {string} workspaceId - Workspace ID
 * @param {File} file - Image file to process
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function processAvatarFile(workspaceId, file) {
	try {
		// Validate
		const validationError = await validateImageFile(file);
		if (validationError) {
			return { success: false, error: validationError };
		}

		// Resize
		const resizedBlob = await resizeImage(file);

		// Save
		const avatarPath = await saveAvatarToFileSystem(workspaceId, resizedBlob);

		return { success: true, path: avatarPath };
	} catch (error) {
		console.error('[avatar-handler] Failed to process avatar:', error);
		return { success: false, error: error.message || 'Failed to process avatar' };
	}
}
