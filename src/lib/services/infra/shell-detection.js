/**
 * Shell Detection Service
 * Detects available shells on the system per platform
 */
import { invoke } from '@tauri-apps/api/core';
import { isWin } from '$lib/utils/path/file-utils';

const isMac =
	typeof window !== 'undefined' &&
	(navigator.platform.includes('Mac') || navigator.userAgent.includes('Macintosh'));

/**
 * Detect available shells for current platform
 * @returns {Promise<Array>} Array of {label, value, available}
 */
export async function detectAvailableShells() {
	try {
		const shells = await invoke('detect_available_shells');
		return shells;
	} catch (error) {
		console.error('Failed to detect shells:', error);
		// Fallback to defaults
		return getDefaultShellsForPlatform();
	}
}

/**
 * Get default shells for the current platform (fallback)
 * @returns {Array} Array of {label, value, available}
 */
function getDefaultShellsForPlatform() {
	if (isWin) {
		return [
			{ label: 'PowerShell', value: 'powershell.exe', available: true },
			{ label: 'Git Bash', value: 'C:\\Program Files\\Git\\bin\\bash.exe', available: false },
			{ label: 'Command Prompt', value: 'cmd.exe', available: true },
			{ label: 'WSL', value: 'wsl.exe', available: false }
		];
	} else if (isMac) {
		return [
			{ label: 'Zsh', value: '/bin/zsh', available: true },
			{ label: 'Bash', value: '/bin/bash', available: true }
		];
	} else {
		return [
			{ label: 'Bash', value: '/bin/bash', available: true },
			{ label: 'Zsh', value: '/bin/zsh', available: false },
			{ label: 'Fish', value: '/usr/bin/fish', available: false }
		];
	}
}

/**
 * Get current platform identifier
 * @returns {string} 'windows' | 'macos' | 'linux'
 */
export function getCurrentPlatform() {
	if (isWin) return 'windows';
	if (isMac) return 'macos';
	return 'linux';
}
