import { writable } from 'svelte/store';

/**
 * Store for host creation draft
 * Persists until app closes or save is successful
 */
function createHostDraftStore() {
	const { subscribe, set, update } = writable({
		label: '',
		connectionType: 'ssh',
		hostname: '',
		port: 22,
		username: 'root',
		authMethod: 'key',
		keyId: null,
		password: '',
		groupId: '',
		notes: '',
		homeDirectory: ''
	});

	return {
		subscribe,
		set,
		update,
		clear: () =>
			set({
				label: '',
				connectionType: 'ssh',
				hostname: '',
				port: 22,
				username: 'root',
				authMethod: 'key',
				keyId: null,
				password: '',
				groupId: '',
				notes: '',
				homeDirectory: ''
			})
	};
}

export const hostDraftStore = createHostDraftStore();
