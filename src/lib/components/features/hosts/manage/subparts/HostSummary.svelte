<script>
	import { Button } from '$lib/components/ui';
	import { useHostFormContext } from '../hostFormContext.svelte.js';

	// Get form context - no props needed!
	const ctx = useHostFormContext();

	// Reactive getters
	const formData = $derived(ctx.formData);
	const errors = $derived(ctx.errors);

	const isDisabled = $derived(
		!formData.label.trim() ||
			!formData.hostname.trim() ||
			!!errors.label ||
			!!errors.hostname ||
			(ctx.supportsSshKey(formData.connectionType) &&
				formData.authMethod === 'key' &&
				!formData.keyId) ||
			(ctx.supportsSshKey(formData.connectionType) &&
				formData.authMethod === 'password' &&
				!formData.password.trim()) ||
			(!ctx.supportsSshKey(formData.connectionType) && !formData.password.trim())
	);
</script>

<Button variant="success" fullWidth onclick={ctx.handleSave} disabled={isDisabled}>
	{#if ctx.isEditMode}
		{ctx.hasChanges() ? 'Save & Connect' : 'Connect'}
	{:else}
		Connect
	{/if}
</Button>
