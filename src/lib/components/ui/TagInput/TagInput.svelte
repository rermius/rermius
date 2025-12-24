<script>
	import { X, Tag } from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';

	let {
		tags = $bindable([]),
		allTags = [],
		placeholder = 'Add tag',
		showSuggestions = true
	} = $props();

	let newTagInput = $state('');
	let isOpen = $state(false);
	let highlightedIndex = $state(0);
	let inputElement;

	function removeTag(tagToRemove) {
		tags = tags.filter(tag => tag !== tagToRemove);
	}

	function handleTagInputKeydown(event) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (!isOpen && filteredSuggestions.length > 0) {
				isOpen = true;
				return;
			}
			highlightedIndex = (highlightedIndex + 1) % filteredSuggestions.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (!isOpen && filteredSuggestions.length > 0) {
				isOpen = true;
				return;
			}
			highlightedIndex =
				(highlightedIndex - 1 + filteredSuggestions.length) % filteredSuggestions.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();

			if (!isOpen || filteredSuggestions.length === 0) {
				createTagFromInput();
				return;
			}

			const item = filteredSuggestions[highlightedIndex];
			if (!item) {
				createTagFromInput();
			} else if (item.type === 'create') {
				createTagFromInput();
			} else if (item.type === 'existing') {
				selectExistingTag(item.value);
			}
		} else if (event.key === 'Escape') {
			isOpen = false;
		} else if (event.key === 'Backspace' && newTagInput === '' && tags.length > 0) {
			// Remove last tag when backspace on empty input
			tags = tags.slice(0, -1);
		}
	}

	function handleInput() {
		// Open dropdown when typing
		const trimmed = newTagInput.trim();
		if (trimmed && showSuggestions) {
			isOpen = true;
			highlightedIndex = 0;
		} else {
			isOpen = false;
		}
	}

	function handleFocus() {
		if (newTagInput.trim() && showSuggestions && filteredSuggestions.length > 0) {
			isOpen = true;
		}
	}

	function handleBlur() {
		// Small timeout to allow click on dropdown items
		setTimeout(() => {
			isOpen = false;
		}, 150);
	}

	function createTagFromInput() {
		const tag = newTagInput.trim();
		if (!tag) return;
		if (!tags.includes(tag)) {
			tags = [...tags, tag];
		}
		newTagInput = '';
		isOpen = false;
		highlightedIndex = 0;
	}

	function selectExistingTag(tag) {
		if (!tags.includes(tag)) {
			tags = [...tags, tag];
		}
		newTagInput = '';
		isOpen = false;
		highlightedIndex = 0;
	}

	// Filter available tags (exclude already selected)
	const availableTags = $derived(allTags.filter(tag => !tags.includes(tag)));

	// Build filtered suggestions
	const filteredSuggestions = $derived.by(() => {
		const input = newTagInput.trim().toLowerCase();
		if (!input) return [];

		const items = [];

		// Filter matching existing tags
		const matchingTags = availableTags.filter(tag => tag.toLowerCase().includes(input));

		// Add matching existing tags
		for (const tag of matchingTags) {
			items.push({
				type: 'existing',
				value: tag,
				label: tag
			});
		}

		// If no matches, show "Create tag" option
		if (matchingTags.length === 0) {
			items.push({
				type: 'create',
				label: `Create Tag ${newTagInput.trim()}`
			});
		}

		return items;
	});
</script>

<div class="relative w-full">
	<!-- Input container with inline tags -->
	<div
		role="button"
		tabindex="-1"
		class="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-(--color-bg-surface) border border-border rounded-lg focus-within:ring-1 focus-within:ring-[var(--color-active)] focus-within:border-[var(--color-active)] transition-all"
		onclick={() => inputElement?.focus()}
		onkeydown={e => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				inputElement?.focus();
			}
		}}
	>
		<!-- Tag icon -->
		<Tag size={16} class="text-text-tertiary flex-shrink-0" />

		<!-- Selected tags -->
		{#each tags as tag (tag)}
			<div
				class="flex items-center gap-1 px-2 py-1 bg-bg-tertiary border border-border rounded text-xs text-text-primary"
			>
				<span>{tag}</span>
				<button
					type="button"
					onclick={e => {
						e.stopPropagation();
						removeTag(tag);
					}}
					class="text-text-tertiary hover:text-text-primary transition-colors"
				>
					<X size={12} />
				</button>
			</div>
		{/each}

		<!-- Input field -->
		<input
			bind:this={inputElement}
			bind:value={newTagInput}
			oninput={handleInput}
			onkeydown={handleTagInputKeydown}
			onfocus={handleFocus}
			onblur={handleBlur}
			placeholder={tags.length === 0 ? placeholder : ''}
			class="flex-1 min-w-[60px] bg-transparent border-none outline-none text-sm text-text-primary placeholder-text-tertiary"
		/>
	</div>

	<!-- Suggestions dropdown -->
	{#if showSuggestions && isOpen && filteredSuggestions.length > 0}
		<ScrollArea
			class="absolute z-20 mt-1 w-full rounded-lg bg-(--color-bg-surface) border border-border shadow-lg max-h-48"
		>
			<div class="py-1">
				{#each filteredSuggestions as item, index (item.type === 'create' ? `create-${newTagInput}` : item.value)}
					<button
						type="button"
						onclick={() => {
							if (item.type === 'create') {
								createTagFromInput();
							} else {
								selectExistingTag(item.value);
							}
						}}
						class="flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors {index ===
						highlightedIndex
							? 'bg-bg-secondary text-text-primary'
							: 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}"
					>
						<span>{item.label}</span>
						{#if item.type === 'create'}
							<span class="text-[10px] text-text-tertiary">Enter</span>
						{/if}
					</button>
				{/each}
			</div>
		</ScrollArea>
	{/if}
</div>

<style>
	input::-webkit-search-cancel-button {
		display: none;
	}
</style>
