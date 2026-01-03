<script>
	import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input } from '$lib/components/ui';
	import { FilePlus, FolderPlus } from 'lucide-svelte';

	let {
		open = $bindable(false),
		type = 'file', // 'file' | 'folder'
		onConfirm,
		onCancel
	} = $props();

	let name = $state('');
	let error = $state('');
	let externalError = $state('');
	let isLoading = $state(false);

	$effect(() => {
		if (open) {
			name = '';
			error = '';
			externalError = '';
			isLoading = false;
		}
	});

	async function handleConfirm() {
		// Prevent duplicate clicks
		if (isLoading) return;

		const trimmedName = name.trim();
		if (!trimmedName) {
			error = 'Name cannot be empty';
			return;
		}

		// Basic validation: check for invalid characters
		// eslint-disable-next-line no-control-regex
		const invalidChars = /[<>:"|?*\x00-\x1f]/;
		if (invalidChars.test(trimmedName)) {
			error = 'Name contains invalid characters';
			return;
		}

		// Clear any previous external error
		externalError = '';
		isLoading = true;

		try {
			// Call onConfirm, but don't close modal yet - let parent handle success/error
			await onConfirm?.(trimmedName);
		} finally {
			// Reset loading state if parent doesn't close modal (e.g., on error)
			// Note: Parent should close modal on success, so this handles error cases
			if (open) {
				isLoading = false;
			}
		}
	}

	// Expose method to set error from parent
	export function setError(message) {
		externalError = message;
		error = ''; // Clear validation error
		isLoading = false; // Reset loading on error
	}

	// Expose method to clear error
	export function clearError() {
		externalError = '';
		error = '';
	}

	// Expose method to close modal (called by parent on success)
	export function closeModal() {
		isLoading = false;
		open = false;
	}

	function handleCancel() {
		open = false;
		onCancel?.();
	}

	function handleKeyDown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleConfirm();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			handleCancel();
		}
	}
</script>

<Modal {open} size="sm" onclose={handleCancel}>
	<ModalHeader title={type === 'file' ? 'New File' : 'New Folder'} onclose={handleCancel}>
		<div class="flex items-center gap-2">
			{#if type === 'file'}
				<FilePlus size={18} class="text-green-400" />
			{:else}
				<FolderPlus size={18} class="text-green-400" />
			{/if}
		</div>
	</ModalHeader>
	<ModalBody>
		<div class="flex flex-col gap-4">
			<div>
				<label for="name-input" class="block text-sm font-medium text-white/80 mb-2">
					{type === 'file' ? 'File name' : 'Folder name'}
				</label>
				<Input
					id="name-input"
					type="text"
					bind:value={name}
					onkeydown={handleKeyDown}
					placeholder={type === 'file' ? 'Enter file name...' : 'Enter folder name...'}
					autofocus
					disabled={isLoading}
					error={!!error || !!externalError}
				/>
				{#if error}
					<p class="text-xs text-red-400 mt-1">{error}</p>
				{:else if externalError}
					<p class="text-xs text-red-400 mt-1">{externalError}</p>
				{/if}
			</div>
		</div>
	</ModalBody>
	<ModalFooter>
		<Button variant="ghost" onclick={handleCancel} disabled={isLoading}>Cancel</Button>
		<Button variant="primary" onclick={handleConfirm} disabled={isLoading}>
			{#if isLoading}
				Creating...
			{:else}
				Create {type === 'file' ? 'File' : 'Folder'}
			{/if}
		</Button>
	</ModalFooter>
</Modal>
