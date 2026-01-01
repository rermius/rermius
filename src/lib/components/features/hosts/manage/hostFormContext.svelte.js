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
import { addHost, updateHost, hostsStore } from '$lib/services';
import { hostDraftStore } from '$lib/stores';
import { handleHostConnect, useSaveQueue } from '$lib/composables';
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

	// NEW: Track created entity to prevent duplicates
	let createdHost = $state(null);

	// Computed: effective editing host (from prop or created)
	const effectiveEditingHost = $derived(() => {
		const editingHost = getEditingHost();
		return editingHost || createdHost;
	});

	// ========== SAVE QUEUE ==========
	// Setup save queue - Single Save Queue Pattern
	const saveQueue = useSaveQueue(
		async data => {
			const groups = getGroups();
			const effective = effectiveEditingHost();

			const dataToSave = {
				...data,
				groupId: data.groupId || groups[0]?.id || defaultGroupId,
				proxyJump: serializeChain(hostChainIds)
			};

			let savedHost;
			if (effective) {
				savedHost = await updateHost(effective.id, dataToSave);
			} else {
				savedHost = await addHost(dataToSave);
			}

			hostDraftStore.clear();

			return savedHost;
		},
		{
			onAutoSave: result => {
				console.log('Auto-saved host:', result);

				// NEW: If this was a create (no editing entity), switch to edit mode
				if (!effectiveEditingHost()) {
					createdHost = result; // Store created entity
					isEditMode = true; // Switch to edit mode
					onsave?.(result); // Notify parent about created host
					console.log('✅ Auto-switched to edit mode with ID:', result.id);
				}
			},
			onManualSave: result => {
				// Manual save success: trigger callback
				// Note: For host, we don't reset form (keep in edit mode)
				onsave?.(result);
			},
			onError: error => {
				console.error('Save failed:', error);
				if (error.message?.includes('label') && error.message?.includes('already exists')) {
					errors = { ...errors, label: error.message };
				}
			}
		}
	);

	// Auto-save on form changes - Debounced
	$effect(() => {
		// Watch formData for changes (only trigger if there's meaningful content)
		if (formData.label || formData.hostname) {
			saveQueue.save(formData); // Debounced auto-save
		}
	});

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

	function handleLabelChange(value) {
		updateField('label', value ?? '');
		// Clear any existing error when label changes
		errors = { ...errors, label: '' };
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
		saveQueue.reset();
	}

	/**
	 * Manual save handler
	 * Validates form, then saves immediately (cancels debounce)
	 */
	async function handleSave() {
		if (!validateForm()) return;

		// Save immediately (cancel debounce, save now)
		const result = await saveQueue.save(formData, { immediate: true });

		if (result.success) {
			resetForm();
		}
	}

	/**
	 * Connect button handler
	 * Validates → Saves immediately → Connects to host
	 * Note: Does NOT reset form - keeps in edit mode for reconnection
	 */
	async function handleConnect() {
		// Validate first
		if (!validateForm()) {
			return;
		}

		// Save immediately (cancel debounce, save now)
		const result = await saveQueue.save(formData, { immediate: true });

		if (!result.success) {
			return;
		}

		// Get the host to connect to
		let hostToConnect;
		if (result.skipped) {
			// Data unchanged, use effective editing host
			hostToConnect = effectiveEditingHost();
		} else {
			hostToConnect = result.result;
		}

		if (!hostToConnect) {
			console.error('No host to connect to');
			return;
		}

		// Connect to the saved host
		try {
			await handleHostConnect(hostToConnect);
			// Don't reset form - keep in edit mode for easy reconnection
			// User can manually close panel if they want to create new host
		} catch (error) {
			console.error('Failed to connect:', error);
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
			// User clicked edit existing entity
			isEditMode = true;
			createdHost = null; // Clear any created entity
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
			saveQueue.reset();
		} else if (!createdHost) {
			// Only reset if no created entity
			// (don't reset after auto-create)
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
			saveQueue.reset();
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

		// Save queue
		saveQueue,

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
		handleConnect,

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
