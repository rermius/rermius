/**
 * Base interfaces and result shapes for sync drivers.
 * Drivers handle upload, download, check, and latest metadata retrieval.
 */

/**
 * @typedef {Object} SyncCheckResult
 * @property {boolean} hasUpdate
 * @property {string|null} latestVersion
 * @property {Date|null} latestTimestamp
 * @property {string|null} error
 */

/**
 * @typedef {Object} SyncLatestResult
 * @property {string|null} version
 * @property {Date|null} timestamp
 * @property {string|null} error
 */

/**
 * @typedef {Object} SyncUploadResult
 * @property {boolean} success
 * @property {string|null} latestVersion
 * @property {Date|null} latestTimestamp
 * @property {string|null} providerId
 * @property {string|null} message
 */

/**
 * @typedef {Object} SyncDownloadResult
 * @property {boolean} success
 * @property {Object|null} data
 * @property {string|null} version
 * @property {string|null} message
 */

/**
 * Base class for sync drivers.
 * Implementations should override all methods.
 */
export class BaseSyncDriver {
	/**
	 * Check for updates compared to last known version.
	 * @param {string|null} lastKnownVersion
	 * @returns {Promise<SyncCheckResult>}
	 */
	async checkForUpdates(lastKnownVersion) {
		throw new Error('Not implemented');
	}

	/**
	 * Get latest version metadata.
	 * @returns {Promise<SyncLatestResult>}
	 */
	async getLatestVersion() {
		throw new Error('Not implemented');
	}

	/**
	 * Upload encrypted parts to provider.
	 * @param {Object} options
	 * @returns {Promise<SyncUploadResult>}
	 */
	async upload(options) {
		throw new Error('Not implemented');
	}

	/**
	 * Download data (optionally by version/sha).
	 * @param {Object} options
	 * @returns {Promise<SyncDownloadResult>}
	 */
	async download(options) {
		throw new Error('Not implemented');
	}
}
