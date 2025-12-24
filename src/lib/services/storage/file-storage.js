import { tauriFs } from '../tauri/fs.js';
import { appDataDir } from '@tauri-apps/api/path';

/**
 * File-based storage service using Tauri file system
 * Provides persistent storage for application data
 */
export const fileStorage = {
	/**
	 * Get application config directory path
	 * @returns {Promise<string>} Config directory path
	 */
	async getConfigPath() {
		try {
			const configPath = await appDataDir();
			return configPath;
		} catch (error) {
			console.error('Failed to get config path:', error);
			throw new Error(`Failed to get config path: ${error}`);
		}
	},

	/**
	 * Save hosts configuration to file
	 * @param {Array<Object>} hosts - Array of host objects
	 * @returns {Promise<void>}
	 */
	async saveHosts(hosts) {
		try {
			const configPath = await this.getConfigPath();
			if (!configPath) {
				throw new Error('Config path not available');
			}

			const hostsPath = `${configPath}/hosts.json`;
			await tauriFs.writeFile(hostsPath, JSON.stringify(hosts, null, 2));
		} catch (error) {
			console.error('Failed to save hosts:', error);
			throw new Error(`Failed to save hosts: ${error}`);
		}
	},

	/**
	 * Load hosts configuration from file
	 * @returns {Promise<Array<Object>>} Array of host objects
	 */
	async loadHosts() {
		try {
			const configPath = await this.getConfigPath();
			if (!configPath) {
				return [];
			}

			const hostsPath = `${configPath}/hosts.json`;
			const exists = await tauriFs.fileExists(hostsPath);

			if (!exists) {
				return [];
			}

			const content = await tauriFs.readFile(hostsPath);
			return JSON.parse(content);
		} catch (error) {
			console.error('Failed to load hosts:', error);
			return [];
		}
	},

	/**
	 * Save generic data to file
	 * @param {string} filename - Filename (without path)
	 * @param {*} data - Data to save (will be JSON stringified)
	 * @returns {Promise<void>}
	 */
	async save(filename, data) {
		try {
			const configPath = await this.getConfigPath();
			if (!configPath) {
				throw new Error('Config path not available');
			}

			const filePath = `${configPath}/${filename}`;
			await tauriFs.writeFile(filePath, JSON.stringify(data, null, 2));
		} catch (error) {
			console.error(`Failed to save ${filename}:`, error);
			throw new Error(`Failed to save ${filename}: ${error}`);
		}
	},

	/**
	 * Load generic data from file
	 * @param {string} filename - Filename (without path)
	 * @param {*} defaultValue - Default value if file doesn't exist
	 * @returns {Promise<*>} Parsed data or default value
	 */
	async load(filename, defaultValue = null) {
		try {
			const configPath = await this.getConfigPath();
			if (!configPath) {
				return defaultValue;
			}

			const filePath = `${configPath}/${filename}`;
			const exists = await tauriFs.fileExists(filePath);

			if (!exists) {
				return defaultValue;
			}

			const content = await tauriFs.readFile(filePath);
			return JSON.parse(content);
		} catch (error) {
			console.error(`Failed to load ${filename}:`, error);
			return defaultValue;
		}
	}
};
