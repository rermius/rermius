/**
 * Utility Services
 * General-purpose utilities and helpers
 */

export {
	createTempFilePath,
	registerTempFile,
	unregisterTempFile,
	cleanupTempFile,
	cleanupAllTempFiles,
	getActiveTempFiles,
	getTempFileInfo,
	startWatching,
	stopWatching
} from './temp-file-manager.js';
export {
	checkMigrationNeeded,
	migrateExistingUser,
	restoreFromBackup
} from './workspace-migration.js';
export { createLocalTerminal } from './terminal-manager.js';
export { keyboardShortcutManager } from './keyboard-shortcuts.js';
export { parseSSHConfig } from './ssh-config.js';
