/**
 * Sync Services
 * Data synchronization, import/export, and backup management
 */

export {
	loadSyncSettings,
	saveSyncSettings,
	clearSyncSettings,
	validateGitHubCredentials,
	downloadFromGitHub,
	getGistHistory,
	downloadGistVersion,
	uploadToGitHub,
	buildEncryptedParts
} from './settings.js';

export {
	initAutoSync,
	stopAutoSync,
	markLoadingStart,
	markLoadingComplete,
	forceSync as triggerManualSync
} from './auto.js';

export {
	exportSyncData,
	generateExportFilename
} from './export.js';

export {
	importSyncData
} from './import.js';

export {
	createSyncDriver as syncCheckerFactory,
	performCheckForUpdates,
	performGetLatestVersion,
	performUpload,
	performDownload
} from './checker/index.js';
