<script>
	import Modal from '$lib/components/ui/Modal/Modal.svelte';
	import Button from '$lib/components/ui/Button/Button.svelte';
	import Input from '$lib/components/ui/Input/Input.svelte';
	import FieldError from '$lib/components/forms/FieldError.svelte';
	import { AvatarUpload } from '$lib/components/ui/AvatarUpload';
	import { ScrollArea } from '$lib/components/ui';
	import { useForm } from '$lib/composables/useForm.svelte.js';
	import { validateWorkspaceName } from '$lib/utils/validators.js';
	import { isWorkspaceNameDuplicate } from '$lib/services';
	import { useToast } from '$lib/composables/useToast.svelte.js';
	import { validateImageFile } from '$lib/utils/avatar-handler.js';
	import { workspaceStore } from '$lib/stores';

	let {
		open = $bindable(false),
		editMode = false,
		workspaceData = null,
		onConfirm = () => {},
		onCancel = () => {},
		requireAction = false
	} = $props();

	const toast = useToast();

	// Check if workspaces already exist
	const hasExistingWorkspaces = $derived($workspaceStore.workspaces.length > 0);

	// Form initial values - defaults, will be set by $effect when modal opens
	const initialValues = {
		name: '',
		avatarFile: null,
		color: '#4A9FFF'
	};

	// Form validation function
	function validate(values) {
		const errors = {};

		// Validate name
		const nameError = validateWorkspaceName(values.name);
		if (nameError) {
			errors.name = nameError;
		} else {
			// Check for duplicate names - use current workspaceData from props
			const currentWorkspaceId = editMode ? workspaceData?.id : null;
			const isDuplicate = isWorkspaceNameDuplicate(values.name, currentWorkspaceId);
			if (isDuplicate) {
				errors.name = 'A workspace with this name already exists';
			}
		}

		return errors;
	}

	// Form submit handler
	async function handleFormSubmit(values) {
		try {
			console.log('[WorkspaceCreationModal] Submitting form:', { editMode, values });

			// Validate avatar if provided (only if it's a File object, not null)
			if (values.avatarFile instanceof File) {
				const avatarError = await validateImageFile(values.avatarFile);
				if (avatarError) {
					form.setFieldError('avatarFile', avatarError);
					return;
				}
			}

			// Prepare data to send
			const submitData = {
				name: values.name.trim()
			};

			// Handle avatar:
			// - If it's a File object: new avatar uploaded
			// - If it's null: user wants to remove avatar
			// - If it's a string (avatarPath): no change, don't include in update
			if (values.avatarFile instanceof File) {
				// New avatar file uploaded
				submitData.avatarFile = values.avatarFile;
			} else if (values.avatarFile === null && editMode && workspaceData?.avatarPath) {
				// User removed existing avatar
				submitData.avatarFile = null;
			}
			// If avatarFile is a string (existing path), don't include it (no change)

			console.log('[WorkspaceCreationModal] Calling onConfirm with:', submitData);

			// Call confirm handler
			await onConfirm(submitData);

			// Close modal on success
			open = false;
		} catch (error) {
			console.error('[WorkspaceCreationModal] Submit error:', error);
			toast.error(error.message || 'Failed to save workspace');
		}
	}

	// Initialize form
	const form = useForm({
		initialValues,
		validate,
		onSubmit: handleFormSubmit
	});

	// Destructure stores for easier access
	const { values, errors, isSubmitting, isValid } = form;

	// Handle skip button (creates default workspace)
	async function handleSkip() {
		try {
			await onConfirm({
				name: 'Default',
				avatarFile: null
			});
			open = false;
		} catch (error) {
			console.error('[WorkspaceCreationModal] Skip error:', error);
			toast.error('Failed to create default workspace');
		}
	}

	// Handle cancel
	function handleCancel() {
		if (requireAction) return; // Cannot cancel if action is required
		open = false;
		onCancel();
		form.reset();
	}

	// Reset form when modal opens/closes
	$effect(() => {
		if (open && editMode && workspaceData) {
			form.setValues({
				name: workspaceData.name,
				avatarFile: workspaceData.avatarPath || null, // Use existing avatar path if available
				color: workspaceData.color || '#4A9FFF'
			});
		} else if (open && !editMode) {
			form.reset();
		}
	});

	// Re-validate form when avatar or name changes (bind:value updates store directly)
	let lastValidatedState = $state({ avatar: null, name: '' });
	$effect(() => {
		if (!open) return;

		const currentAvatar = $values.avatarFile;
		const currentName = $values.name;

		// Only re-validate if values actually changed
		if (currentAvatar !== lastValidatedState.avatar || currentName !== lastValidatedState.name) {
			lastValidatedState = { avatar: currentAvatar, name: currentName };

			// Validate form
			if (validate) {
				const validationErrors = validate($values);
				const hasErrors = Object.keys(validationErrors).filter(k => validationErrors[k]).length > 0;

				// Update form validity - use form methods to ensure consistency
				if (hasErrors) {
					// Set errors for fields that have errors
					Object.keys(validationErrors).forEach(key => {
						if (validationErrors[key]) {
							form.setFieldError(key, validationErrors[key]);
						}
					});
				} else {
					// Form is valid, clear all errors
					form.clearErrors();
				}
			}
		}
	});
</script>

<Modal
	bind:open
	size="md"
	closeOnBackdrop={!requireAction}
	closeOnEscape={!requireAction}
	onclose={handleCancel}
>
	{#snippet children({ close })}
		<form onsubmit={form.handleSubmit} class="flex flex-col h-full">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-border">
				<h2 class="text-xl font-semibold text-text-primary">
					{editMode ? 'Edit Workspace' : 'Create Workspace'}
				</h2>
				<p class="text-sm text-text-secondary mt-1">
					{editMode
						? 'Update your workspace details'
						: 'Create a new workspace to organize your connections'}
				</p>
			</div>

			<!-- Form Body -->
			<ScrollArea class="flex-1">
				<div class="px-6 py-6 space-y-6">
					<!-- Avatar Upload -->
					<div class="flex flex-col items-center">
						<div class="text-sm font-medium text-text-primary mb-3">Workspace Avatar</div>
						<AvatarUpload
							bind:value={$values.avatarFile}
							error={$errors.avatarFile}
							disabled={$isSubmitting}
							workspaceName={$values.name || 'Workspace'}
							workspaceColor={$values.color}
						/>
					</div>

					<!-- Name Input -->
					<div>
						<label for="workspace-name" class="block text-sm font-medium text-text-primary mb-2">
							Workspace Name
							<span class="text-red-500">*</span>
						</label>
						<Input
							id="workspace-name"
							type="text"
							bind:value={$values.name}
							placeholder="e.g., Personal, Work, Development"
							disabled={$isSubmitting}
							error={!!$errors.name}
							required
							oninput={e => form.setFieldValue('name', e.target.value)}
						/>
						<FieldError error={$errors.name} />
					</div>

					<!-- Form-level error -->
					{#if $errors._form}
						<div class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
							<p class="text-sm text-red-500">{$errors._form}</p>
						</div>
					{/if}
				</div>
			</ScrollArea>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
				{#if !editMode && !requireAction && !hasExistingWorkspaces}
					<!-- Skip button (only in create mode, not required, and no existing workspaces) -->
					<Button
						variant="ghost"
						size="md"
						disabled={$isSubmitting}
						onclick={handleSkip}
						type="button"
					>
						{#snippet children()}
							Skip
						{/snippet}
					</Button>
				{/if}

				{#if !requireAction}
					<!-- Cancel button (not shown if action is required) -->
					<Button
						variant="secondary"
						size="md"
						disabled={$isSubmitting}
						onclick={handleCancel}
						type="button"
					>
						{#snippet children()}
							Cancel
						{/snippet}
					</Button>
				{/if}

				{#if !editMode && requireAction && !hasExistingWorkspaces}
					<!-- Skip button for first launch (only if no existing workspaces) -->
					<Button
						variant="secondary"
						size="md"
						disabled={$isSubmitting}
						onclick={handleSkip}
						type="button"
					>
						{#snippet children()}
							Skip & Create Default
						{/snippet}
					</Button>
				{/if}

				<!-- Submit button -->
				<Button variant="primary" size="md" disabled={$isSubmitting || !$isValid} type="submit">
					{#snippet children()}
						{#if $isSubmitting}
							{editMode ? 'Saving...' : 'Creating...'}
						{:else}
							{editMode ? 'Save Changes' : 'Create Workspace'}
						{/if}
					{/snippet}
				</Button>
			</div>
		</form>
	{/snippet}
</Modal>
