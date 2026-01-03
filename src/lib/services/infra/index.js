/**
 * Infrastructure Services
 * Core platform services: Tauri commands, storage, network monitoring
 */

// Re-export from existing barrels
export {
	tauriCommands,
	tauriEvents,
	tauriDialog,
	tauriFs,
	terminalCommands,
	terminalEvents
} from './tauri/index.js';

export { localStorage, fileStorage } from './storage/index.js';

// Direct exports
export { networkStateMonitor, networkOnline } from './network-state.js';
export { detectAvailableShells, getCurrentPlatform } from './shell-detection.js';
