<script>
	import { Button } from '$lib/components/ui';
	import { useHostFormContext } from '../hostFormContext.svelte.js';

	// Get form context - no props needed!
	const ctx = useHostFormContext();

	// Reactive getters
	const formData = $derived(ctx.formData);
	const errors = $derived(ctx.errors);

	// Disable if form invalid OR saving
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
			(!ctx.supportsSshKey(formData.connectionType) && !formData.password.trim()) ||
			ctx.saveQueue.isSaving
	);
</script>

<Button variant="success" fullWidth onclick={ctx.handleConnect} disabled={isDisabled}>
	Connect
</Button>
