<script>
	import { Key, Info, Upload } from 'lucide-svelte';
	import { Input, Textarea, Button, IconInput, TagInput } from '$lib/components/ui';
	import { createEventDispatcher } from 'svelte';
	import { tauriDialog } from '$lib/services/tauri/dialog';
	import { tauriFs } from '$lib/services/tauri/fs';
	import { addKey, updateKey, findDuplicateKey } from '$lib/services';
	import PanelLayout from '$lib/components/layout/PanelLayout.svelte';
	import { useSaveQueue } from '$lib/composables';

	const dispatch = createEventDispatcher();

	const { editingKey = null, onclose, onmenu } = $props();

	let formData = $state({
		label: '',
		privateKey: '',
		publicKey: '',
		certificate: '',
		keyType: '',
		tags: []
	});

	let labelError = $state('');
	let keyWarning = $state('');
	let isEditMode = $state(false);

	// NEW: Track created entity to prevent duplicates
	let createdKey = $state(null);

	// Computed: effective editing entity (from prop or created)
	const effectiveEditingKey = $derived(editingKey || createdKey);

	// Setup save queue - Single Save Queue Pattern
	const saveQueue = useSaveQueue(
		async (data) => {
			// Check if we have an entity to update (from prop or created)
			if (effectiveEditingKey) {
				return await updateKey(effectiveEditingKey.id, data);
			} else {
				return await addKey(data);
			}
		},
		{
			onAutoSave: (result) => {
				// NEW: If this was a create (no editing entity), switch to edit mode
				if (!effectiveEditingKey) {
					createdKey = result; // Store created entity
					isEditMode = true; // Switch to edit mode
					dispatch('import', result); // Notify parent about created key
				}
			},
			onManualSave: (result) => {
				// Manual save success: dispatch event and reset form
				dispatch('import', result);

				// Reset to create mode
				formData = {
					label: '',
					privateKey: '',
					publicKey: '',
					certificate: '',
					keyType: '',
					tags: []
				};
				labelError = '';
				keyWarning = '';
				createdKey = null; // Clear created entity
				isEditMode = false; // Back to create mode
				saveQueue.reset();
			},
			onError: (error) => {
				console.error('Save failed:', error);
				if (error.message.startsWith('A key with label')) {
					labelError = error.message;
				} else if (error.message.startsWith('This key already exists')) {
					keyWarning = '⚠️ ' + error.message;
				}
			}
		}
	);

	// Load editing key data when component mounts or editingKey changes
	$effect(() => {
		if (editingKey) {
			// User clicked edit existing entity
			isEditMode = true;
			createdKey = null; // Clear any created entity
			formData = {
				label: editingKey.label,
				privateKey: editingKey.privateKey,
				publicKey: editingKey.publicKey || '',
				certificate: editingKey.certificate || '',
				keyType: editingKey.keyType,
				tags: editingKey.tags || []
			};
			labelError = '';
			keyWarning = '';
			saveQueue.reset();
		} else if (!createdKey) {
			// Only reset if no created entity
			// (don't reset after auto-create)
			isEditMode = false;
			formData = {
				label: '',
				privateKey: '',
				publicKey: '',
				certificate: '',
				keyType: '',
				tags: []
			};
			labelError = '';
			keyWarning = '';
			saveQueue.reset();
		}
	});

	// Auto-save on form changes - Debounced
	$effect(() => {
		// Watch formData for changes
		if (formData.label || formData.privateKey) {
			saveQueue.save(formData); // Debounced auto-save
		}
	});

	/**
	 * Detect SSH key type from private key content
	 */
	function detectKeyType(privateKey) {
		if (privateKey.includes('BEGIN RSA PRIVATE KEY')) {
			return 'RSA';
		} else if (privateKey.includes('BEGIN OPENSSH PRIVATE KEY')) {
			// OpenSSH format - need to check the content for actual type
			if (privateKey.includes('ssh-ed25519')) {
				return 'ED25519';
			} else if (privateKey.includes('ecdsa-sha2')) {
				return 'ECDSA';
			} else if (privateKey.includes('ssh-rsa')) {
				return 'RSA';
			}
			return 'OpenSSH';
		} else if (privateKey.includes('BEGIN EC PRIVATE KEY')) {
			return 'ECDSA';
		} else if (privateKey.includes('BEGIN DSA PRIVATE KEY')) {
			return 'DSA';
		} else if (privateKey.includes('BEGIN PRIVATE KEY')) {
			return 'PKCS8';
		}
		return 'Unknown';
	}

	/**
	 * Parse and analyze SSH key file
	 */
	async function parseKeyFile(filePath) {
		try {
			// Read the private key file
			const privateKeyContent = await tauriFs.readFile(filePath);
			formData.privateKey = privateKeyContent;

			// Detect key type
			formData.keyType = detectKeyType(privateKeyContent);

			// Try to read corresponding public key file
			try {
				const pubKeyPath = filePath + '.pub';
				const pubKeyExists = await tauriFs.fileExists(pubKeyPath);

				if (pubKeyExists) {
					const publicKeyContent = await tauriFs.readFile(pubKeyPath);
					formData.publicKey = publicKeyContent;
				}
			} catch (pubKeyError) {
				// Silently skip if we can't access the public key file
				console.warn('Could not load public key file:', pubKeyError.message);
			}

			// Check for duplicate key (exclude current key if editing)
			const excludeKeyId = isEditMode ? editingKey.id : null;
			const duplicateKey = findDuplicateKey(formData.privateKey, formData.publicKey, excludeKeyId);
			if (duplicateKey) {
				keyWarning = `⚠️ This key already exists as "${duplicateKey.label}"`;
			} else {
				keyWarning = '';
			}

			// Auto-generate label from filename if not set
			if (!formData.label) {
				const fileName = filePath.split(/[\\/]/).pop();
				formData.label = fileName.replace(/\.(pem|key|ssh)$/, '');
			}
		} catch (error) {
			console.error('Failed to parse key file:', error);
		}
	}

	/**
	 * Open file browser to select key file
	 */
	async function handleBrowseFile() {
		try {
			const filePath = await tauriDialog.openFile({
				title: 'Select SSH Private Key',
				filters: [
					{
						name: 'SSH Keys',
						extensions: ['pem', 'key', 'ssh', 'rsa', 'ed25519', 'ecdsa', '*']
					}
				]
			});

			if (filePath) {
				await parseKeyFile(filePath);
			}
		} catch (error) {
			console.error('Failed to open file:', error);
		}
	}

	async function handleSave() {
		// Validate label
		if (!formData.label.trim()) {
			labelError = 'Label is required';
			return;
		}

		// Save immediately - onManualSave callback handles dispatch + reset
		await saveQueue.save(formData, { immediate: true });
	}

	function handleDrop(event) {
		event.preventDefault();
		// Handle file drop
		const files = event.dataTransfer.files;
		if (files.length > 0) {
			// Note: Web File API path is not accessible in browser
			// This would need Tauri drag-drop plugin support
		}
	}

	function handleDragOver(event) {
		event.preventDefault();
	}

	function handleLabelChange() {
		// Clear any existing error when label changes
		labelError = '';
	}

	/**
	 * Handle private key blur - detect type and check for duplicates
	 */
	function handlePrivateKeyBlur() {
		if (!formData.privateKey || !formData.privateKey.trim()) {
			formData.keyType = '';
			keyWarning = '';
			return;
		}

		// Detect key type
		const detectedType = detectKeyType(formData.privateKey);
		if (detectedType !== 'Unknown') {
			formData.keyType = detectedType;
		}

		// Check for duplicate key (exclude current key if editing)
		const excludeKeyId = isEditMode ? editingKey?.id : null;
		const duplicateKey = findDuplicateKey(formData.privateKey, formData.publicKey, excludeKeyId);
		if (duplicateKey) {
			keyWarning = `⚠️ This key already exists as "${duplicateKey.label}"`;
		} else {
			keyWarning = '';
		}
	}
</script>

<PanelLayout
	title={isEditMode ? 'Edit Key' : 'Key'}
	saveStatus={saveQueue.status}
	showMenu={!!onmenu && isEditMode}
	showClose={!!onclose}
	{onmenu}
	{onclose}
	{content}
	{footer}
/>

{#snippet content()}
	<div class="flex flex-col gap-4">
		<!-- General Section -->
		<div class="text-xs text-text-tertiary uppercase tracking-wider">General</div>

		<!-- Label -->
		<div class="flex flex-col gap-1">
			<IconInput
				icon="tag"
				id="label"
				bind:value={formData.label}
				oninput={handleLabelChange}
				placeholder="Key label"
				error={!!labelError}
				required
			/>
			{#if labelError}
				<span class="text-xs text-error pl-10">{labelError}</span>
			{/if}
		</div>

		<!-- Key Type Display -->
		{#if formData.keyType}
			<div class="flex items-center gap-2 bg-border px-3 py-2 rounded-lg">
				<Key size={16} class="text-primary" />
				<span class="text-xs text-text-secondary">
					Key Type: <span class="text-text-primary font-semibold">{formData.keyType}</span>
				</span>
			</div>
		{/if}

		<!-- Tags -->
		<TagInput bind:tags={formData.tags} />

		<!-- Duplicate Key Warning -->
		{#if keyWarning}
			<div
				class="flex items-center gap-2 bg-orange-500/20 border border-orange-500/50 px-3 py-2 rounded-lg"
			>
				<Info size={16} class="text-orange-500" />
				<span class="text-xs text-orange-200">{keyWarning}</span>
			</div>
		{/if}

		<!-- Keys Section -->
		<div class="text-xs text-text-tertiary uppercase tracking-wider mt-2">Keys</div>

		<!-- Private Key Textarea -->
		<div class="flex flex-col gap-1">
			<label class="text-xs text-text-tertiary" for="privateKey">Private key</label>
			<Textarea
				id="privateKey"
				bind:value={formData.privateKey}
				onblur={handlePrivateKeyBlur}
				placeholder="-----BEGIN PRIVATE KEY-----"
				rows={4}
				resize={false}
			/>
		</div>

		<!-- Public Key Textarea -->
		<div class="flex flex-col gap-1">
			<label class="text-xs text-text-tertiary" for="publicKey">Public key</label>
			<Textarea
				id="publicKey"
				bind:value={formData.publicKey}
				placeholder="ssh-rsa AAAA..."
				rows={4}
				resize={false}
			/>
		</div>

		<!-- Certificate Textarea -->
		<div class="flex flex-col gap-1">
			<label class="text-xs text-text-tertiary" for="certificate">Certificate (optional)</label>
			<Textarea
				id="certificate"
				bind:value={formData.certificate}
				placeholder="Optional..."
				rows={4}
				resize={false}
			/>
		</div>

		<!-- Drag & Drop Area / Browse Button (only show in add mode) -->
		{#if !isEditMode}
			<div
				ondrop={handleDrop}
				ondragover={handleDragOver}
				onclick={handleBrowseFile}
				onkeydown={e => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleBrowseFile();
					}
				}}
				role="button"
				tabindex="0"
				class="border-2 border-dashed bg-bg-secondary rounded-lg p-8 flex flex-col items-center justify-center gap-3 hover:border-primary transition-colors cursor-pointer"
			>
				<Upload size={24} class="text-text-tertiary" />
				<p class="text-sm text-text-secondary text-center">
					Click to browse or drag and drop a private key file
				</p>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet footer()}
	<Button
		variant="success"
		fullWidth
		onclick={handleSave}
		disabled={!formData.label.trim() || !!labelError || !!keyWarning}
	>
		{isEditMode ? 'Save Changes' : 'Import Key'}
	</Button>
{/snippet}
