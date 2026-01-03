<script>
	import { Upload, X } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { loadAvatarAsDataUrl } from '$lib/utils/avatar-handler.js';
	import { getWorkspaceInitials } from '$lib/services';
	import Button from '../Button/Button.svelte';

	let {
		value = $bindable(null),
		size = 96,
		error = null,
		disabled = false,
		workspaceName = '',
		workspaceColor = '#4A9FFF',
		onchange = () => {}
	} = $props();

	let fileInputRef = $state(null);
	let previewUrl = $state(null);
	let isLoading = $state(false);
	let lastProcessedValue = $state(null);

	// Derived state for avatar display
	const hasAvatar = $derived(value !== null && value !== undefined);
	const initials = $derived(getWorkspaceInitials(workspaceName));

	/**
	 * Load preview URL based on value type
	 */
	async function loadPreview() {
		if (!value) {
			if (previewUrl) {
				// Clean up previous preview
				if (previewUrl.startsWith('blob:')) {
					URL.revokeObjectURL(previewUrl);
				}
				previewUrl = null;
			}
			return;
		}

		// Skip if preview already exists for this value
		if (value instanceof File && previewUrl?.startsWith('blob:')) {
			// Check if it's the same file (by comparing object URL)
			return;
		}

		isLoading = true;

		try {
			if (value instanceof File) {
				// File object - create object URL
				if (previewUrl && previewUrl.startsWith('blob:')) {
					URL.revokeObjectURL(previewUrl);
				}
				previewUrl = URL.createObjectURL(value);
			} else if (typeof value === 'string') {
				// String path - load from filesystem
				// Only reload if path changed
				if (previewUrl !== value) {
					previewUrl = await loadAvatarAsDataUrl(value);
				}
			}
		} catch (err) {
			console.error('[AvatarUpload] Failed to load preview:', err);
			previewUrl = null;
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Handle file input change
	 */
	function handleFileChange(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		value = file;
		onchange(file);
	}

	/**
	 * Open file picker
	 */
	function openFilePicker() {
		if (disabled) return;
		fileInputRef?.click();
	}

	/**
	 * Remove avatar
	 */
	function removeAvatar() {
		if (disabled) return;

		// Revoke object URL if exists
		if (previewUrl && previewUrl.startsWith('blob:')) {
			URL.revokeObjectURL(previewUrl);
		}

		value = null;
		previewUrl = null;
		onchange(null);

		// Reset file input
		if (fileInputRef) {
			fileInputRef.value = '';
		}
	}

	/**
	 * Cleanup on unmount
	 */
	$effect(() => {
		return () => {
			if (previewUrl && previewUrl.startsWith('blob:')) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	});

	/**
	 * Watch value changes and update preview
	 * Only process when value actually changes to prevent infinite loops
	 */
	$effect(() => {
		// Skip if value hasn't actually changed
		if (value === lastProcessedValue) return;

		lastProcessedValue = value;
		loadPreview();
	});
</script>

<div class="flex flex-col items-center gap-4">
	<!-- Avatar Preview -->
	<div class="relative" style="width: {size}px; height: {size}px;">
		<div class="w-full h-full rounded-full overflow-hidden border-2 border-border">
			{#if isLoading}
				<!-- Loading state -->
				<div class="w-full h-full flex items-center justify-center bg-(--color-bg-secondary)">
					<div
						class="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"
					></div>
				</div>
			{:else if previewUrl}
				<!-- Avatar image -->
				<img src={previewUrl} alt="Avatar preview" class="w-full h-full object-cover" />
			{:else}
				<!-- Placeholder with initials -->
				<div
					class="w-full h-full flex items-center justify-center text-white font-semibold"
					style="background-color: {workspaceColor}; font-size: {size / 3}px;"
				>
					{initials}
				</div>
			{/if}
		</div>

		<!-- Remove button (only if avatar exists) -->
		{#if hasAvatar && !disabled}
			<button
				type="button"
				onclick={removeAvatar}
				class="absolute -top-1 -right-0.5 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg z-20 cursor-pointer"
				aria-label="Remove avatar"
			>
				<X size={8} />
			</button>
		{/if}
	</div>

	<!-- Upload button -->
	<Button variant="secondary" size="sm" {disabled} onclick={openFilePicker} type="button">
		{#snippet children()}
			<Upload size={16} />
			{hasAvatar ? 'Change Photo' : 'Upload Photo'}
		{/snippet}
	</Button>

	<!-- Error message -->
	{#if error}
		<p class="text-xs text-(--color-error) text-center">
			{error}
		</p>
	{/if}

	<!-- Hidden file input -->
	<input
		bind:this={fileInputRef}
		type="file"
		accept="image/png,image/jpeg,image/jpg,image/webp"
		onchange={handleFileChange}
		class="hidden"
		aria-label="Upload avatar"
	/>
</div>
