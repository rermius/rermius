<script>
	import { Input, Textarea, Button, IconInput, TagInput } from '$lib/components/ui';
	import { Tag, Terminal } from 'lucide-svelte';
	import { addSnippet, updateSnippet, isSnippetNameDuplicate, snippetsStore } from '$lib/services';
	import { debounce } from '$lib/utils';
	import PanelLayout from '$lib/components/layout/PanelLayout.svelte';

	const { editingSnippet = null, onsave, ondelete } = $props();

	let nameError = $state('');
	let isEditMode = $state(false);

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
			isEditMode = true;
			const data = {
				name: editingSnippet.name || '',
				command: editingSnippet.command || '',
				labels: editingSnippet.labels || []
			};
			formData = { ...data };
			originalData = { ...data };
			nameError = '';
		} else {
			isEditMode = false;
			originalData = null;
			// Reset form when switching from edit to add mode
			formData = {
				name: '',
				command: '',
				labels: []
			};
			nameError = '';
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

	// Create debounced validation handler for name
	const debouncedNameCheck = debounce((trimmedName, excludeId) => {
		if (isSnippetNameDuplicate(trimmedName, excludeId)) {
			nameError = 'This name already exists';
		} else {
			nameError = '';
		}
	}, 300);

	function handleNameChange(event) {
		const value = event?.target?.value ?? formData.name;
		const trimmedName = typeof value === 'string' ? value.trim() : value;

		if (!trimmedName) {
			nameError = '';
			return;
		}

		if (trimmedName.length > 60) {
			nameError = 'Name must be 60 characters or less';
			return;
		}

		const excludeId = isEditMode ? editingSnippet?.id : null;
		debouncedNameCheck(trimmedName, excludeId);
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

	async function saveSnippet() {
		const savedSnippet = isEditMode
			? await updateSnippet(editingSnippet.id, formData)
			: await addSnippet(formData);

		onsave?.(savedSnippet);

		return savedSnippet;
	}

	async function handleSave() {
		if (!validateForm()) return;

		try {
			await saveSnippet();
			resetForm();
		} catch (error) {
			console.error('Failed to save snippet:', error);
			if (error.message?.includes('name') && error.message?.includes('already exists')) {
				nameError = error.message;
			} else {
				console.error('Failed to save snippet:', error.message);
			}
		}
	}
</script>

<PanelLayout title={isEditMode ? 'Edit Snippet' : 'Snippet'} {content} {footer} />

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
