import { BaseSyncDriver } from '../base.js';
import {
	uploadToGitHub,
	downloadFromGitHub,
	downloadGistVersion,
	buildEncryptedParts
} from '$lib/services/sync-settings.js';

/**
 * GitHub Gist Sync Driver
 * Implements upload/download/check via GitHub Gist API.
 */
export class GithubGistDriver extends BaseSyncDriver {
	constructor(config) {
		super();
		this.token = config.token;
		this.gistId = config.gistId;
		this.encryptPassword = config.encryptPassword;
		this.baseUrl = 'https://api.github.com';
	}

	get providerId() {
		return this.gistId;
	}

	getHeaders() {
		return {
			Authorization: `token ${this.token}`,
			Accept: 'application/vnd.github.v3+json'
		};
	}

	async getLatestVersion() {
		if (!this.gistId || !this.token) {
			return { version: null, timestamp: null, error: 'Missing gist ID or token' };
		}

		try {
			const response = await fetch(`${this.baseUrl}/gists/${this.gistId}/commits?per_page=1`, {
				headers: this.getHeaders(),
				cache: 'no-store'
			});

			if (!response.ok) {
				if (response.status === 404) {
					return { version: null, timestamp: null, error: 'Gist not found' };
				}
				if (response.status === 401) {
					return { version: null, timestamp: null, error: 'Invalid token' };
				}
				return { version: null, timestamp: null, error: `API error: ${response.status}` };
			}

			const commits = await response.json();

			if (!commits || commits.length === 0) {
				return { version: null, timestamp: null, error: 'No commits found' };
			}

			const latestCommit = commits[0];
			return {
				version: latestCommit.version,
				timestamp: new Date(latestCommit.committed_at),
				error: null
			};
		} catch (error) {
			console.error('Failed to fetch latest gist version:', error);
			return { version: null, timestamp: null, error: error.message };
		}
	}

	async checkForUpdates(lastKnownVersion) {
		const { version, timestamp, error } = await this.getLatestVersion();

		if (error) {
			return { hasUpdate: false, latestVersion: null, latestTimestamp: null, error };
		}

		if (!lastKnownVersion) {
			return {
				hasUpdate: false,
				latestVersion: version,
				latestTimestamp: timestamp,
				error: null
			};
		}

		const hasUpdate = version !== lastKnownVersion;

		return {
			hasUpdate,
			latestVersion: version,
			latestTimestamp: timestamp,
			error: null
		};
	}

	/**
	 * Upload data to Gist (driver handles encryption).
	 * @param {{hostsData: Object, syncOptions: Object, snippetsData?: Object, keychainData?: Object, source?: string, onLog?: Function}} options
	 * @returns {Promise<import('../base.js').SyncUploadResult>}
	 */
	async upload({
		hostsData,
		syncOptions,
		snippetsData = null,
		keychainData = null,
		source = 'rerminus',
		onLog = () => {}
	}) {
		if (!this.token) {
			return {
				success: false,
				latestVersion: null,
				latestTimestamp: null,
				providerId: null,
				message: 'Missing token'
			};
		}

		if (!this.encryptPassword) {
			return {
				success: false,
				latestVersion: null,
				latestTimestamp: null,
				providerId: null,
				message: 'Missing encrypt password'
			};
		}

		if (!hostsData || !syncOptions) {
			return {
				success: false,
				latestVersion: null,
				latestTimestamp: null,
				providerId: null,
				message: 'Missing hosts/sync options'
			};
		}

		const parts = await buildEncryptedParts(
			hostsData,
			syncOptions,
			this.encryptPassword,
			onLog,
			snippetsData,
			keychainData
		);

		if (!parts || Object.keys(parts).length === 0) {
			return {
				success: false,
				latestVersion: null,
				latestTimestamp: null,
				providerId: null,
				message: 'No sync items selected'
			};
		}

		const result = await uploadToGitHub({
			token: this.token,
			gistId: this.gistId,
			encryptedParts: parts,
			source,
			onLog
		});

		if (!result.success) {
			return {
				success: false,
				latestVersion: null,
				latestTimestamp: null,
				providerId: null,
				message: result.message
			};
		}

		if (result.gistId) {
			this.gistId = result.gistId;
		}

		// Fetch latest version to return metadata
		const latest = await this.getLatestVersion();

		return {
			success: true,
			latestVersion: latest.version,
			latestTimestamp: latest.timestamp,
			providerId: result.gistId,
			message: result.message || null
		};
	}

	/**
	 * Download current or specific version from Gist.
	 * @param {{sha?: string, encryptPassword?: string, onLog?: Function}} options
	 * @returns {Promise<import('../base.js').SyncDownloadResult>}
	 */
	async download({ sha = null, encryptPassword, onLog = () => {} }) {
		if (!this.token) {
			return { success: false, data: null, version: null, message: 'Missing token' };
		}
		if (!this.gistId) {
			return { success: false, data: null, version: null, message: 'Missing gist ID' };
		}

		const password = encryptPassword || this.encryptPassword;
		if (!password) {
			return { success: false, data: null, version: null, message: 'Missing encrypt password' };
		}

		const result = sha
			? await downloadGistVersion({
					token: this.token,
					gistId: this.gistId,
					sha,
					encryptPassword: password,
					onLog
				})
			: await downloadFromGitHub({
					token: this.token,
					gist: this.gistId,
					encryptPassword: password,
					onLog
				});

		if (!result.success) {
			return { success: false, data: null, version: null, message: result.message };
		}

		return {
			success: true,
			data: result.data,
			version: result.data?.version || null,
			message: result.message
		};
	}
}
