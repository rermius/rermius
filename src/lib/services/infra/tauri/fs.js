/**
 * Tauri file system utilities
 */
import {
	readTextFile,
	writeTextFile,
	readFile as readFilePlugin,
	writeFile as writeFilePlugin,
	exists,
	readDir,
	mkdir,
	remove as removeFile
} from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export const tauriFs = {
	/**
	 * Read text file contents
	 * @param {string} path - File path to read
	 * @returns {Promise<string>} File contents
	 */
	async readFile(path) {
		try {
			return await readTextFile(path);
		} catch (error) {
			console.error('Failed to read file:', error);
			throw new Error(`Failed to read file: ${error}`);
		}
	},

	/**
	 * Write text to file
	 * @param {string} path - File path to write
	 * @param {string} content - Content to write
	 * @returns {Promise<void>}
	 */
	async writeFile(path, content) {
		try {
			return await writeTextFile(path, content);
		} catch (error) {
			console.error('Failed to write file:', error);
			throw new Error(`Failed to write file: ${error}`);
		}
	},

	/**
	 * Check if file exists
	 * @param {string} path - File path to check
	 * @returns {Promise<boolean>} True if file exists
	 */
	async fileExists(path) {
		try {
			return await exists(path);
		} catch (error) {
			console.error('Failed to check file existence:', error);
			return false;
		}
	},

	/**
	 * Read directory contents
	 * @param {string} path - Directory path to read
	 * @returns {Promise<Array>} Array of file entries
	 */
	async readDir(path) {
		try {
			return await readDir(path);
		} catch (error) {
			console.error('Failed to read directory:', error);
			throw new Error(`Failed to read directory: ${error}`);
		}
	},

	/**
	 * Create directory
	 * @param {string} path - Directory path to create
	 * @param {Object} options - Create options
	 * @param {boolean} options.recursive - Create parent directories
	 * @returns {Promise<void>}
	 */
	async createDir(path, options = { recursive: false }) {
		try {
			return await mkdir(path, options);
		} catch (error) {
			console.error('Failed to create directory:', error);
			throw new Error(`Failed to create directory: ${error}`);
		}
	},

	/**
	 * Remove file or directory
	 * @param {string} path - Path to remove
	 * @param {Object} options - Remove options
	 * @param {boolean} options.recursive - Remove directory recursively
	 * @returns {Promise<void>}
	 */
	async remove(path, options = { recursive: false }) {
		try {
			return await removeFile(path, options);
		} catch (error) {
			console.error('Failed to remove:', error);
			throw new Error(`Failed to remove: ${error}`);
		}
	},

	/**
	 * Read binary file contents
	 * @param {string} path - File path to read
	 * @returns {Promise<Uint8Array>} File contents as Uint8Array
	 */
	async readBinaryFile(path) {
		try {
			return await readFilePlugin(path);
		} catch (error) {
			console.error('Failed to read binary file:', error);
			throw new Error(`Failed to read binary file: ${error}`);
		}
	},

	/**
	 * Write binary data to file
	 * @param {string} path - File path to write
	 * @param {Uint8Array} data - Binary data to write
	 * @returns {Promise<void>}
	 */
	async writeBinaryFile(path, data) {
		try {
			return await writeFilePlugin(path, data);
		} catch (error) {
			console.error('Failed to write binary file:', error);
			throw new Error(`Failed to write binary file: ${error}`);
		}
	},

	/**
	 * Scan directory recursively for files matching extensions
	 * @param {string} dirPath - Directory path to scan
	 * @param {string[]} extensions - File extensions to match (e.g., ['pem', 'key', 'ssh'])
	 * @returns {Promise<Array<{path: string, name: string, size: number, modified: number|null}>>}
	 */
	async scanDirectoryRecursive(
		dirPath,
		extensions = ['pem', 'key', 'ssh', 'rsa', 'ed25519', 'ecdsa']
	) {
		const files = [];

		try {
			const entries = await readDir(dirPath);

			for (const entry of entries) {
				const fullPath = await join(dirPath, entry.name);

				if (entry.isDirectory) {
					// Recursive scan
					const subFiles = await this.scanDirectoryRecursive(fullPath, extensions);
					files.push(...subFiles);
				} else if (entry.isFile) {
					const ext = entry.name.split('.').pop()?.toLowerCase();
					if (ext && (extensions.includes(ext) || extensions.includes('*'))) {
						files.push({
							path: fullPath,
							name: entry.name,
							size: entry.size || 0,
							modified: entry.mtime ? Math.floor(entry.mtime.getTime() / 1000) : null
						});
					}
				}
			}
		} catch (error) {
			console.error(`Failed to scan directory ${dirPath}:`, error);
			// Continue scanning other directories, don't throw
		}

		return files;
	}
};
