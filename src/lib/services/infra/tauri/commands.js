import { invoke } from '@tauri-apps/api/core';

/**
 * Tauri command wrappers for invoking Rust backend functions
 * All commands return promises and handle errors gracefully
 */
export const tauriCommands = {
	/**
	 * Greet command (example from Tauri template)
	 * @param {string} name - Name to greet
	 * @returns {Promise<string>} Greeting message
	 */
	async greet(name) {
		try {
			return await invoke('greet', { name });
		} catch (error) {
			console.error('Greet command failed:', error);
			throw new Error(`Failed to greet: ${error}`);
		}
	}

	// Future SSH commands can be added here:
	//
	// async connectSSH(config) {
	//   try {
	//     return await invoke('connect_ssh', { config });
	//   } catch (error) {
	//     console.error('SSH connection failed:', error);
	//     throw new Error(`Failed to connect: ${error}`);
	//   }
	// },
	//
	// async disconnectSSH(sessionId) {
	//   try {
	//     return await invoke('disconnect_ssh', { sessionId });
	//   } catch (error) {
	//     console.error('SSH disconnect failed:', error);
	//     throw new Error(`Failed to disconnect: ${error}`);
	//   }
	// },
	//
	// async executeCommand(sessionId, command) {
	//   try {
	//     return await invoke('execute_command', { sessionId, command });
	//   } catch (error) {
	//     console.error('Command execution failed:', error);
	//     throw new Error(`Failed to execute command: ${error}`);
	//   }
	// }
};
