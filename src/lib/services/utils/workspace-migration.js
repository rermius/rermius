/**
 * Workspace Migration Service
 * Migrates existing users' data to workspace structure
 */

import { tauriFs } from '../infra/tauri/fs.js';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';
import { createDefaultWorkspace } from '../data/workspaces.js';

/**
 * Check if migration is needed
 * @returns {Promise<boolean>} True if migration needed
 */
export async function checkMigrationNeeded() {
	try {
		const appDataDirPath = await appDataDir();

		// Check if workspaces.json exists
		const workspacesPath = await join(appDataDirPath, 'workspaces.json');
		const workspacesExists = await tauriFs.fileExists(workspacesPath);

		if (workspacesExists) {
			// Already using workspace structure
			return false;
		}

		// Check if old data files exist
		const hostsPath = await join(appDataDirPath, 'hosts.json');
		const keychainPath = await join(appDataDirPath, 'keychain.json');
		const snippetsPath = await join(appDataDirPath, 'snippets.json');

		const hostsExists = await tauriFs.fileExists(hostsPath);
		const keychainExists = await tauriFs.fileExists(keychainPath);
		const snippetsExists = await tauriFs.fileExists(snippetsPath);

		// Migration needed if any old data exists
		return hostsExists || keychainExists || snippetsExists;
	} catch (error) {
		console.error('[Migration] Error checking migration status:', error);
		return false;
	}
}

/**
 * Migrate existing user data to workspace structure
 * @returns {Promise<Object>} Migration result
 */
export async function migrateExistingUser() {
	console.log('[Migration] Starting migration for existing user...');

	try {
		const appDataDirPath = await appDataDir();

		// Create backup directory
		const backupDir = await join(appDataDirPath, 'backups', 'pre-workspace-migration');
		await tauriFs.createDir(backupDir, { recursive: true });

		// Backup existing files
		const filesToMigrate = [
			'hosts.json',
			'keychain.json',
			'snippets.json',
			'sync-settings.json',
			'app-settings.json'
		];

		const backedUpFiles = [];
		for (const fileName of filesToMigrate) {
			const sourcePath = await join(appDataDirPath, fileName);
			const exists = await tauriFs.fileExists(sourcePath);

			if (exists) {
				console.log(`[Migration] Backing up ${fileName}...`);
				const backupPath = await join(backupDir, fileName);
				const content = await tauriFs.readFile(sourcePath);
				await tauriFs.writeFile(backupPath, content);
				backedUpFiles.push(fileName);
			}
		}

		console.log(`[Migration] Backed up ${backedUpFiles.length} files to ${backupDir}`);

		// Create default workspace
		console.log('[Migration] Creating Default workspace...');
		const defaultWorkspace = await createDefaultWorkspace();

		// Move files to workspace directory
		const workspaceDir = await join(appDataDirPath, 'workspaces', defaultWorkspace.id);

		const movedFiles = [];
		for (const fileName of backedUpFiles) {
			const sourcePath = await join(appDataDirPath, fileName);
			const targetPath = await join(workspaceDir, fileName);

			console.log(`[Migration] Moving ${fileName} to workspace directory...`);
			const content = await tauriFs.readFile(sourcePath);
			await tauriFs.writeFile(targetPath, content);

			// Delete original file
			await tauriFs.remove(sourcePath);
			movedFiles.push(fileName);
		}

		console.log(`[Migration] Moved ${movedFiles.length} files to workspace directory`);

		// Create workspace-avatars directory
		const avatarsDir = await join(appDataDirPath, 'workspace-avatars');
		await tauriFs.createDir(avatarsDir, { recursive: true });

		console.log('[Migration] Migration completed successfully!');

		return {
			success: true,
			workspaceId: defaultWorkspace.id,
			workspaceName: defaultWorkspace.name,
			backedUpFiles: backedUpFiles.length,
			movedFiles: movedFiles.length,
			backupLocation: backupDir
		};
	} catch (error) {
		console.error('[Migration] Migration failed:', error);
		throw new Error(`Migration failed: ${error.message}`);
	}
}

/**
 * Restore from migration backup (in case of failure)
 * @returns {Promise<boolean>} Success status
 */
export async function restoreFromBackup() {
	try {
		const appDataDirPath = await appDataDir();
		const backupDir = await join(appDataDirPath, 'backups', 'pre-workspace-migration');

		// Check if backup exists
		const exists = await tauriFs.fileExists(backupDir);
		if (!exists) {
			console.warn('[Migration] No backup found to restore');
			return false;
		}

		const filesToRestore = [
			'hosts.json',
			'keychain.json',
			'snippets.json',
			'sync-settings.json',
			'app-settings.json'
		];

		let restoredCount = 0;
		for (const fileName of filesToRestore) {
			const backupPath = await join(backupDir, fileName);
			const exists = await tauriFs.fileExists(backupPath);

			if (exists) {
				const targetPath = await join(appDataDirPath, fileName);
				const content = await tauriFs.readFile(backupPath);
				await tauriFs.writeFile(targetPath, content);
				restoredCount++;
				console.log(`[Migration] Restored ${fileName}`);
			}
		}

		console.log(`[Migration] Restored ${restoredCount} files from backup`);
		return true;
	} catch (error) {
		console.error('[Migration] Restore from backup failed:', error);
		throw error;
	}
}
