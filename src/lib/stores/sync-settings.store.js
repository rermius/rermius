import { writable } from 'svelte/store';

/**
 * Sync Settings Store
 * Manages sync configuration for different providers (github, gitee, custom, cloud)
 */
function createSyncSettingsStore() {
	// Function to get fresh default settings
	const getDefaultSettings = () => ({
		__loaded: false, // internal flag to avoid early writes before settings load
		activeTab: 'github', // 'github' | 'gitee' | 'custom' | 'cloud'
		github: {
			token: '',
			gist: '',
			encryptPassword: '',
			isValidated: false // Credentials validated - enables upload/download
		},
		gitee: {
			token: '',
			gist: '',
			encryptPassword: '',
			isValidated: false
		},
		custom: {
			url: '',
			token: '',
			encryptPassword: '',
			isValidated: false
		},
		cloud: {
			provider: 'none', // 'none' | 's3' | 'gcs' | 'azure'
			credentials: {},
			encryptPassword: '',
			isValidated: false
		},
		syncOptions: {
			settings: true,
			bookmarks: true,
			terminalThemes: true,
			quickCommands: true,
			profiles: true,
			addressBookmarks: true
		},
		lastSync: {
			lastUpload: null, // timestamp of last upload
			lastDownload: null // timestamp of last download
		},
		autoSync: {
			enabled: false
		},
		syncVersion: {
			lastKnownVersion: null,
			latestRemoteVersion: null,
			latestRemoteTimestamp: null,
			lastCheckTime: null,
			isChecking: false,
			checkError: null
		}
	});

	const { subscribe, set, update } = writable(getDefaultSettings());

	return {
		subscribe,
		set,
		update,
		setActiveTab: tab => update(s => ({ ...s, activeTab: tab })),
		updateGithub: data => update(s => ({ ...s, github: { ...s.github, ...data } })),
		updateGitee: data => update(s => ({ ...s, gitee: { ...s.gitee, ...data } })),
		updateCustom: data => update(s => ({ ...s, custom: { ...s.custom, ...data } })),
		updateCloud: data => update(s => ({ ...s, cloud: { ...s.cloud, ...data } })),
		updateSyncOptions: options =>
			update(s => ({ ...s, syncOptions: { ...s.syncOptions, ...options } })),
		updateLastSync: syncData => update(s => ({ ...s, lastSync: { ...s.lastSync, ...syncData } })),
		updateAutoSync: data => update(s => ({ ...s, autoSync: { ...s.autoSync, ...data } })),
		// Validation status methods
		setValidated: (provider, isValidated) =>
			update(s => ({
				...s,
				[provider]: { ...s[provider], isValidated }
			})),
		invalidateAll: () =>
			update(s => ({
				...s,
				github: { ...s.github, isValidated: false },
				gitee: { ...s.gitee, isValidated: false },
				custom: { ...s.custom, isValidated: false },
				cloud: { ...s.cloud, isValidated: false }
			})),
		reset: () => set(getDefaultSettings())
	};
}

export const syncSettingsStore = createSyncSettingsStore();
