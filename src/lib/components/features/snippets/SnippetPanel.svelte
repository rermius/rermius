<script>
	import { Input, Textarea, Button, IconInput, TagInput } from '$lib/components/ui';
	import { Tag, Terminal } from 'lucide-svelte';
	import { addSnippet, updateSnippet, snippetsStore } from '$lib/services';
	import PanelLayout from '$lib/components/layout/PanelLayout.svelte';
	import { useSaveQueue } from '$lib/composables';

	const { editingSnippet = null, onsave, ondelete, onclose, onmenu } = $props();

	let nameError = $state('');
	let isEditMode = $state(false);

	// NEW: Track created entity to prevent duplicates
	let createdSnippet = $state(null);

	// Computed: effective editing entity (from prop or created)
	const effectiveEditingSnippet = $derived(editingSnippet || createdSnippet);

	// Setup save queue - Single Save Queue Pattern
	const saveQueue = useSaveQueue(
		async (data) => {
			// Check if we have an entity to update (from prop or created)
			if (effectiveEditingSnippet) {
				return await updateSnippet(effectiveEditingSnippet.id, data);
			} else {
				return await addSnippet(data);
			}
		},
		{
			onAutoSave: (result) => {
				// NEW: If this was a create (no editing entity), switch to edit mode
				if (!effectiveEditingSnippet) {
					createdSnippet = result; // Store created entity
					isEditMode = true; // Switch to edit mode
					onsave?.(result); // Notify parent about created snippet
				}
			},
			onManualSave: (result) => {
				// Manual save success: trigger callback and reset form
				onsave?.(result);

				// Reset to create mode
				formData = {
					name: '',
					command: '',
					labels: []
				};
				nameError = '';
				createdSnippet = null; // Clear created entity
				isEditMode = false; // Back to create mode
				saveQueue.reset();
			},
			onError: (error) => {
				console.error('Save failed:', error);
				if (error.message?.includes('name') && error.message?.includes('already exists')) {
					nameError = error.message;
				}
			}
		}
	);

	// Get all tags for autocomplete (reactive)
	const allTags = $derived.by(() => {
		const data = $snippetsStore;
		const allLabels = (data.snippets || []).flatMap(s => s.labels || []);
		return [...new Set(allLabels)].sort();
	});

	// Form data
	let formData = $state({
		name: '',
		command: '',
		labels: []
	});

	// Store original data for comparison
	let originalData = $state(null);

	// Load editing snippet data when component mounts or editingSnippet changes
	$effect(() => {
		if (editingSnippet) {
			// User clicked edit existing entity
			isEditMode = true;
			createdSnippet = null; // Clear any created entity
			const data = {
				name: editingSnippet.name || '',
				command: editingSnippet.command || '',
				labels: editingSnippet.labels || []
			};
			formData = { ...data };
			originalData = { ...data };
			nameError = '';
			saveQueue.reset();
		} else if (!createdSnippet) {
			// Only reset if no created entity
			// (don't reset after auto-create)
			isEditMode = false;
			originalData = null;
			formData = {
				name: '',
				command: '',
				labels: []
			};
			nameError = '';
			saveQueue.reset();
		}
	});

	// Auto-save on form changes - Debounced
	$effect(() => {
		// Watch formData for changes
		if (formData.name || formData.command) {
			saveQueue.save(formData); // Debounced auto-save
		}
	});

	// Check if data has changed
	const hasChanges = $derived(() => {
		if (!isEditMode || !originalData) return true;

		const currentLabelsSorted = JSON.stringify([...(formData.labels || [])].sort());
		const originalLabelsSorted = JSON.stringify([...(originalData.labels || [])].sort());

		return (
			formData.name !== originalData.name ||
			formData.command !== originalData.command ||
			currentLabelsSorted !== originalLabelsSorted
		);
	});

	function handleNameChange(event) {
		const value = event?.target?.value ?? formData.name;
		const trimmedName = typeof value === 'string' ? value.trim() : value;

		// Clear error first
		nameError = '';

		// Keep length validation only
		if (trimmedName && trimmedName.length > 60) {
			nameError = 'Name must be 60 characters or less';
		}
	}

	function validateForm() {
		if (!formData.name.trim()) {
			nameError = 'Name is required';
			return false;
		}

		if (formData.name.length > 60) {
			nameError = 'Name must be 60 characters or less';
			return false;
		}

		// Check if command has content
		if (!formData.command.trim()) {
			return false;
		}

		return true;
	}

	function resetForm() {
		formData = {
			name: '',
			command: '',
			labels: []
		};
		nameError = '';
	}

	async function handleSave() {
		if (!validateForm()) return;

		// Save immediately - onManualSave callback handles onsave + reset
		await saveQueue.save(formData, { immediate: true });
	}
</script>

<PanelLayout
	title={isEditMode ? 'Edit Snippet' : 'Snippet'}
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

		<!-- Name -->
		<div class="flex flex-col gap-1">
			<IconInput
				iconComponent={Tag}
				id="name"
				bind:value={formData.name}
				oninput={handleNameChange}
				placeholder="Snippet name"
				error={!!nameError}
				required
				maxlength={60}
			/>
			{#if nameError}
				<span class="text-xs text-error pl-10">{nameError}</span>
			{/if}
		</div>

		<!-- Command Section -->
		<div class="text-xs text-text-tertiary uppercase tracking-wider mt-2">Command</div>

		<Textarea bind:value={formData.command} placeholder="Command" rows={3} required />

		<!-- Tags Section -->
		<div class="text-xs text-text-tertiary uppercase tracking-wider mt-2">Tags</div>
		<TagInput bind:tags={formData.labels} {allTags} />
	</div>
{/snippet}

{#snippet footer()}
	<Button
		variant="success"
		fullWidth
		onclick={handleSave}
		disabled={!formData.name.trim() || !formData.command.trim() || !!nameError || !hasChanges}
	>
		{isEditMode ? 'Update' : 'Save'}
	</Button>
{/snippet}
