/**
 * Host Form Context
 *
 * Provides shared form state and handlers for host management components.
 * Eliminates prop drilling by sharing formData, errors, and field handlers
 * across HostFormBasics, HostAuthSection, HostAdvancedSection, and HostSummary.
 *
 * @example
 * // In HostPanel.svelte (parent)
 * import { createHostFormContext } from './hostFormContext.svelte.js';
 *
 * const ctx = createHostFormContext({
 *   getEditingHost: () => editingHost,
 *   getGroups: () => groups,
 *   getAllHosts: () => allHosts,
 *   defaultGroupId: 'group-default',
 *   autoConnect: true,
 *   onsave: (host) => console.log('Saved:', host)
 * });
 *
 * // In subparts (children) - no props needed!
 * import { useHostFormContext } from './hostFormContext.svelte.js';
 *
 * const ctx = useHostFormContext();
 * // Access: ctx.formData, ctx.errors, ctx.updateField('label', value), etc.
 */

import { setContext, getContext } from 'svelte';
import { get } from 'svelte/store';
import { debounce } from '$lib/utils';
import { addHost, updateHost, isHostLabelDuplicate, hostsStore } from '$lib/services';
import { hostDraftStore } from '$lib/stores';
import { handleHostConnect } from '$lib/composables';
import { parseChain, serializeChain, getChainSummary } from '$lib/utils/host-chaining.js';

const HOST_FORM_CTX = Symbol('host-form');

// Connection type options
const CONNECTION_TYPES = [
	{ value: 'ssh', label: 'SSH', icon: 'server-filled' },
	{ value: 'sftp', label: 'SFTP', icon: 'upload' },
	{ value: 'ftp', label: 'FTP', icon: 'upload' },
	{ value: 'ftps', label: 'FTPS', icon: 'lock' },
	{ value: 'telnet', label: 'Telnet', icon: 'server-filled' }
];

// Default ports for connection types
const DEFAULT_PORTS = {
	ssh: 22,
	sftp: 22,
	ftp: 21,
	ftps: 990,
	telnet: 23
};

/**
 * Creates and provides host form context to child components
 *
 * @param {Object} options - Configuration options
 * @param {() => Object|null} options.getEditingHost - Getter for editing host (reactive)
 * @param {() => Array} options.getGroups - Getter for groups list (reactive)
 * @param {() => Array} options.getAllHosts - Getter for all hosts (reactive)
 * @param {() => Array} options.getStoreTags - Getter for store tags (reactive)
 * @param {string} [options.defaultGroupId='group-default'] - Default group ID
 * @param {boolean} [options.autoConnect=true] - Auto connect after save
 * @param {Function} [options.onsave] - Callback when host is saved
 * @returns {Object} The created context object
 */
export function createHostFormContext(options) {
	const {
		getEditingHost,
		getGroups,
		getAllHosts,
		getStoreTags,
		defaultGroupId = 'group-default',
		autoConnect = true,
		onsave
	} = options;

	// ========== STATE ==========
	let formData = $state({
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
		homeDirectory: '',
		tags: []
	});

	let errors = $state({
		label: '',
		hostname: ''
	});

	let isEditMode = $state(false);
	let originalData = $state(null);
	let hostChainIds = $state([]);
	let showAdvanced = $state(false);
	let isHostChainingOpen = $state(false);
	let localAllTags = $state([]);

	// ========== DERIVED ==========
	const connectionTypes = CONNECTION_TYPES;

	// ========== HELPERS ==========
	function supportsSshKey(type) {
		return type === 'ssh' || type === 'sftp';
	}

	function supportsHostChaining(type) {
		return type === 'ssh' || type === 'sftp';
	}

	// ========== FIELD HANDLERS ==========
	function updateField(key, value) {
		formData = { ...formData, [key]: value };
	}

	// Debounced label duplicate check
	const debouncedLabelCheck = debounce((trimmedLabel, excludeId) => {
		if (isHostLabelDuplicate(trimmedLabel, excludeId)) {
			errors = { ...errors, label: 'This label already exists' };
		} else {
			errors = { ...errors, label: '' };
		}
	}, 300);

	function handleLabelChange(value) {
		updateField('label', value ?? '');
		const trimmedLabel = typeof value === 'string' ? value.trim() : value;

		if (!trimmedLabel) {
			errors = { ...errors, label: '' };
			return;
		}

		const editingHost = getEditingHost();
		const excludeId = isEditMode ? editingHost?.id : null;
		debouncedLabelCheck(trimmedLabel, excludeId);
	}

	function handleHostnameChange(value) {
		updateField('hostname', value ?? '');
		errors = { ...errors, hostname: '' };
	}

	function handleUsernameChange(value) {
		updateField('username', value || '');
	}

	function handleGroupChange(value) {
		updateField('groupId', value || '');
	}

	function handlePortChange(value) {
		updateField('port', value || 0);
	}

	function handleTagsChange(tags) {
		updateField('tags', Array.isArray(tags) ? tags : []);
	}

	function handleConnectionTypeChange(value) {
		updateField('connectionType', value ?? 'ssh');

		// Auto-set default port when connection type changes
		if (formData.connectionType && DEFAULT_PORTS[formData.connectionType]) {
			updateField('port', DEFAULT_PORTS[formData.connectionType]);
		}

		// Reset auth method if switching to non-SSH types
		if (!supportsSshKey(formData.connectionType)) {
			if (formData.authMethod === 'key' || formData.authMethod === 'agent') {
				updateField('authMethod', 'password');
				updateField('keyId', null);
			}
		}
	}

	function handleAuthMethodChange(method) {
		updateField('authMethod', method);
		if (method !== 'key') {
			updateField('keyId', null);
		}
		if (method !== 'password') {
			updateField('password', '');
		}
	}

	function handlePasswordChange(value) {
		updateField('password', value || '');
	}

	function handleKeyChange(value) {
		updateField('keyId', value || null);
	}

	function handleNotesChange(value) {
		updateField('notes', value || '');
	}

	function handleHomeDirChange(value) {
		updateField('homeDirectory', value || '');
	}

	function handleHostChainChange(newIds) {
		hostChainIds = Array.isArray(newIds) ? newIds : [];
	}

	function toggleAdvanced() {
		showAdvanced = !showAdvanced;
	}

	function openChaining() {
		isHostChainingOpen = true;
	}

	function closeChaining() {
		isHostChainingOpen = false;
	}

	// ========== FORM ACTIONS ==========
	function validateForm() {
		let valid = true;
		const newErrors = { label: '', hostname: '' };

		if (!formData.label.trim()) {
			newErrors.label = 'Label is required';
			valid = false;
		}
		if (!formData.hostname.trim()) {
			newErrors.hostname = 'Hostname is required';
			valid = false;
		}

		const isSshType = supportsSshKey(formData.connectionType);
		const needsKey = isSshType && formData.authMethod === 'key' && !formData.keyId;
		const needsPassword = isSshType
			? formData.authMethod === 'password' && !formData.password.trim()
			: !formData.password.trim();

		if (needsKey) {
			console.error('Please select an SSH key');
			valid = false;
		}
		if (needsPassword) {
			console.error('Please enter a password');
			valid = false;
		}

		errors = newErrors;
		return valid;
	}

	function resetForm() {
		formData = {
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
			homeDirectory: '',
			tags: []
		};
		errors = { label: '', hostname: '' };
		hostChainIds = [];
		showAdvanced = false;
	}

	async function saveHost() {
		const groups = getGroups();
		const editingHost = getEditingHost();

		const dataToSave = {
			...formData,
			groupId: formData.groupId || groups[0]?.id || defaultGroupId,
			proxyJump: serializeChain(hostChainIds)
		};

		const savedHost = isEditMode
			? await updateHost(editingHost.id, dataToSave)
			: await addHost(dataToSave);

		hostDraftStore.clear();
		onsave?.(savedHost);

		return savedHost;
	}

	async function handleSave() {
		if (!validateForm()) return;

		const editingHost = getEditingHost();

		try {
			const dataChanged = hasChanges();
			const hostToConnect = dataChanged ? await saveHost() : editingHost;

			if (autoConnect) {
				await handleHostConnect(hostToConnect).catch(err =>
					console.error('Failed to connect:', err)
				);
			}

			resetForm();
		} catch (error) {
			console.error('Failed to save host:', error);
			if (error.message?.includes('label') && error.message?.includes('already exists')) {
				errors = { ...errors, label: error.message };
			}
		}
	}

	// ========== COMPUTED ==========
	function hasChanges() {
		if (!isEditMode || !originalData) return true;

		const currentProxyJump = serializeChain(hostChainIds);
		return (
			formData.label !== originalData.label ||
			formData.connectionType !== originalData.connectionType ||
			formData.hostname !== originalData.hostname ||
			formData.port !== originalData.port ||
			formData.username !== originalData.username ||
			formData.authMethod !== originalData.authMethod ||
			formData.keyId !== originalData.keyId ||
			formData.password !== originalData.password ||
			formData.groupId !== originalData.groupId ||
			formData.notes !== originalData.notes ||
			formData.homeDirectory !== (originalData.homeDirectory || '') ||
			currentProxyJump !== originalData.proxyJump
		);
	}

	function getHostChainSummary() {
		const allHosts = getAllHosts();
		const editingHost = getEditingHost();

		if (!hostChainIds || hostChainIds.length === 0) {
			return 'Host Chaining';
		}

		const currentLabel = formData.label?.trim()
			? formData.label.trim()
			: editingHost?.label || editingHost?.hostname || 'Current host';

		return getChainSummary(allHosts, hostChainIds, currentLabel);
	}

	// ========== INITIALIZATION ==========
	function initFromEditingHost(editingHost) {
		if (editingHost) {
			isEditMode = true;
			const data = {
				label: editingHost.label,
				connectionType: editingHost.connectionType || 'ssh',
				hostname: editingHost.hostname,
				port: editingHost.port,
				username: editingHost.username,
				authMethod: editingHost.authMethod,
				keyId: editingHost.keyId,
				password: editingHost.password || '',
				groupId: editingHost.groupId,
				notes: editingHost.notes,
				homeDirectory: editingHost.homeDirectory || '',
				tags: editingHost.tags || []
			};
			formData = { ...data };
			originalData = { ...data, proxyJump: editingHost.proxyJump };
			errors = { label: '', hostname: '' };
			hostChainIds = parseChain(editingHost.proxyJump);
		} else {
			isEditMode = false;
			originalData = null;
			// Use draft from store
			const draft = get(hostDraftStore);
			formData = {
				...draft,
				tags: Array.isArray(draft.tags) ? draft.tags : []
			};
			errors = { label: '', hostname: '' };
			hostChainIds = [];
		}
	}

	function syncDraftToStore() {
		if (!isEditMode) {
			hostDraftStore.set(formData);
		}
	}

	function updateLocalTags(storeTags) {
		const combined = new Set([...(storeTags || []), ...(formData.tags || [])]);
		localAllTags = Array.from(combined).sort();
	}

	// ========== CONTEXT OBJECT ==========
	const ctx = {
		// State (reactive getters)
		get formData() {
			return formData;
		},
		get errors() {
			return errors;
		},
		get isEditMode() {
			return isEditMode;
		},
		get hostChainIds() {
			return hostChainIds;
		},
		get showAdvanced() {
			return showAdvanced;
		},
		get isHostChainingOpen() {
			return isHostChainingOpen;
		},
		get localAllTags() {
			return localAllTags;
		},

		// Static data
		connectionTypes,

		// Helpers
		supportsSshKey,
		supportsHostChaining,

		// Computed
		hasChanges,
		getHostChainSummary,

		// External data getters
		getGroups,
		getAllHosts,
		getEditingHost,

		// Field handlers
		updateField,
		handleLabelChange,
		handleHostnameChange,
		handleUsernameChange,
		handleGroupChange,
		handlePortChange,
		handleTagsChange,
		handleConnectionTypeChange,
		handleAuthMethodChange,
		handlePasswordChange,
		handleKeyChange,
		handleNotesChange,
		handleHomeDirChange,
		handleHostChainChange,

		// UI actions
		toggleAdvanced,
		openChaining,
		closeChaining,

		// Form actions
		validateForm,
		resetForm,
		handleSave,

		// Initialization
		initFromEditingHost,
		syncDraftToStore,
		updateLocalTags
	};

	setContext(HOST_FORM_CTX, ctx);
	return ctx;
}

/**
 * Retrieves the host form context from parent component
 * Must be called during component initialization
 *
 * @returns {Object} Host form context object
 * @throws {Error} If called outside of a host form context provider
 */
export function useHostFormContext() {
	const ctx = getContext(HOST_FORM_CTX);
	if (!ctx) {
		throw new Error(
			'useHostFormContext must be used within a component that has createHostFormContext'
		);
	}
	return ctx;
}
