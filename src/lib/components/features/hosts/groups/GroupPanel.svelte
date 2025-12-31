<script>
	import { Input, Textarea, Button, IconInput } from '$lib/components/ui';
	import { addGroup, updateGroup } from '$lib/services';
	import PanelLayout from '$lib/components/layout/PanelLayout.svelte';
	import { useSaveQueue } from '$lib/composables';

	const { editingGroup = null, onsave, onclose, onmenu } = $props();

	let formData = $state({
		name: '',
		description: '',
		color: '#4A9FFF',
		icon: 'server-filled'
	});

	let nameError = $state('');
	let isEditMode = $state(false);

	// NEW: Track created entity to prevent duplicates
	let createdGroup = $state(null);

	// Computed: effective editing entity (from prop or created)
	const effectiveEditingGroup = $derived(editingGroup || createdGroup);

	// Setup save queue - Single Save Queue Pattern
	const saveQueue = useSaveQueue(
		async (data) => {
			// Check if we have an entity to update (from prop or created)
			if (effectiveEditingGroup) {
				return await updateGroup(effectiveEditingGroup.id, data);
			} else {
				return await addGroup(data);
			}
		},
		{
			onAutoSave: (result) => {
				// NEW: If this was a create (no editing entity), switch to edit mode
				if (!effectiveEditingGroup) {
					createdGroup = result; // Store created entity
					isEditMode = true; // Switch to edit mode
					onsave?.(result); // Notify parent about created group
				}
			},
			onManualSave: (result) => {
				// Manual save success: trigger callback and reset form
				onsave?.(result);

				// Reset to create mode
				formData = {
					name: '',
					description: '',
					color: '#4A9FFF',
					icon: 'server-filled'
				};
				nameError = '';
				createdGroup = null; // Clear created entity
				isEditMode = false; // Back to create mode
				saveQueue.reset();
			},
			onError: (error) => {
				console.error('Save failed:', error);
				if (error.message?.includes('already exists')) {
					nameError = error.message;
				}
			}
		}
	);

	// Color options
	const colorOptions = [
		{ value: '#4A9FFF', label: 'Blue' },
		{ value: '#21b568', label: 'Green' },
		{ value: '#f97316', label: 'Orange' },
		{ value: '#ef4444', label: 'Red' },
		{ value: '#a855f7', label: 'Purple' },
		{ value: '#ec4899', label: 'Pink' },
		{ value: '#14b8a6', label: 'Teal' },
		{ value: '#f59e0b', label: 'Amber' }
	];

	// Load editing group data when editingGroup changes
	$effect(() => {
		if (editingGroup) {
			// User clicked edit existing entity
			isEditMode = true;
			createdGroup = null; // Clear any created entity
			formData = {
				name: editingGroup.name,
				description: editingGroup.description || '',
				color: editingGroup.color || '#4A9FFF',
				icon: editingGroup.icon || 'server-filled'
			};
			nameError = '';
			saveQueue.reset();
		} else if (!createdGroup) {
			// Only reset if no created entity
			// (don't reset after auto-create)
			isEditMode = false;
			formData = {
				name: '',
				description: '',
				color: '#4A9FFF',
				icon: 'server-filled'
			};
			nameError = '';
			saveQueue.reset();
		}
	});

	// Auto-save on form changes - Debounced
	$effect(() => {
		// Watch formData for changes
		if (formData.name || formData.description || formData.color !== '#4A9FFF') {
			saveQueue.save(formData); // Debounced auto-save
		}
	});

	// Manual save button - Immediate save (callback handled by onManualSave)
	async function handleSave() {
		// Validate name
		if (!formData.name.trim()) {
			nameError = 'Name is required';
			return;
		}

		// Save immediately - onManualSave callback will handle onsave + reset
		await saveQueue.save(formData, { immediate: true });
	}

	function handleNameChange() {
		// Clear any existing error when name changes
		nameError = '';
	}
</script>

<PanelLayout
	title={isEditMode ? 'Edit Group' : 'Group'}
	saveStatus={saveQueue.status}
	showMenu={!!onmenu}
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
				icon="widgets-filled"
				id="name"
				bind:value={formData.name}
				oninput={handleNameChange}
				placeholder="Group name"
				error={!!nameError}
				required
			/>
			{#if nameError}
				<span class="text-xs text-error pl-10">{nameError}</span>
			{/if}
		</div>

		<!-- Description -->
		<IconInput
			icon="note"
			id="description"
			bind:value={formData.description}
			placeholder="Description"
		/>

		<!-- Color Selection -->
		<fieldset class="flex flex-col gap-2">
			<div class="grid grid-cols-4 gap-2">
				{#each colorOptions as color (color.value)}
					<button
						type="button"
						onclick={() => (formData.color = color.value)}
						class="h-10 rounded-lg border-2 transition-all flex items-center justify-center {formData.color ===
						color.value
							? 'border-active scale-105'
							: 'border-transparent hover:border-white/20'}"
						style="background-color: {color.value}"
						title={color.label}
						aria-pressed={formData.color === color.value}
					>
						{#if formData.color === color.value}
							<svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		</fieldset>
	</div>
{/snippet}

{#snippet footer()}
	<Button
		variant="success"
		fullWidth
		onclick={handleSave}
		disabled={!formData.name.trim() || !!nameError}
	>
		{isEditMode ? 'Save Changes' : 'Add Group'}
	</Button>
{/snippet}
