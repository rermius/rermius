import { get } from 'svelte/store';
import { syncSettingsStore } from '$lib/stores/sync-settings.store.js';
import { GithubGistDriver } from './providers/gist.js';

const PROVIDERS = {
	github: GithubGistDriver
	// gitee: null,
	// custom: null,
	// cloud: null
};

export function createSyncDriver(providerType, config) {
	const ProviderClass = PROVIDERS[providerType];

	if (!ProviderClass) {
		console.warn(`Sync driver not implemented for provider: ${providerType}`);
		return null;
	}

	return new ProviderClass(config);
}

export function getSyncDriverForCurrentProvider() {
	const settings = get(syncSettingsStore);
	const activeTab = settings.activeTab;
	const providerConfig = settings[activeTab];

	if (!providerConfig?.isValidated) {
		return null;
	}

	switch (activeTab) {
		case 'github':
			return createSyncDriver('github', {
				token: providerConfig.token,
				gistId: providerConfig.gist,
				encryptPassword: providerConfig.encryptPassword
			});
		// Cases for other providers can be added here when implemented.
		default:
			return null;
	}
}

function requireDriver() {
	const driver = getSyncDriverForCurrentProvider();
	if (!driver) {
		throw new Error('No validated sync provider configured');
	}
	return driver;
}

export async function performCheckForUpdates(lastKnownVersion) {
	const driver = requireDriver();
	return await driver.checkForUpdates(lastKnownVersion);
}

export async function performGetLatestVersion() {
	const driver = requireDriver();
	return await driver.getLatestVersion();
}

export async function performUpload(payload) {
	const driver = requireDriver();
	return await driver.upload(payload);
}

export async function performDownload(options = {}) {
	const driver = requireDriver();
	return await driver.download(options);
}
