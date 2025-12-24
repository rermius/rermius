/**
 * Get Lucide icon component for connection type
 * @param {string} connectionType - Connection type (ssh, sftp, ftp, ftps, telnet)
 * @returns {Component} Lucide icon component
 */
import * as LucideIcons from 'lucide-svelte';

export function getConnectionIcon(connectionType) {
	const iconMap = {
		ssh: LucideIcons.Server,
		sftp: LucideIcons.Folder,
		ftp: LucideIcons.Folder,
		ftps: LucideIcons.Lock,
		telnet: LucideIcons.Server,
		terminal: LucideIcons.Terminal,
		snippet: LucideIcons.Code,
		'code-filled': LucideIcons.Code
	};

	return iconMap[connectionType] || LucideIcons.Server;
}
