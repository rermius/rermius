<script>
	import { ContentWithPanel } from '$lib/components/layout';
	import SnippetPanel from './SnippetPanel.svelte';
	import SnippetPageList from './SnippetPageList.svelte';
	import { deleteSnippet, snippetsStore } from '$lib/services';
	import { useToast } from '$lib/composables';
	import { Modal, ModalHeader, ModalBody, ModalFooter } from '$lib/components/ui/Modal';
	import { Button, SearchInput, TagFilterIcon, SortIcon, ScrollArea } from '$lib/components/ui';
	import { LayoutGrid, List } from 'lucide-svelte';
	import { getUiSettings, updateUiSettings } from '$lib/services/app-settings.js';

	const toast = useToast();

	// State
	let showPanel = $state(false);
	let editingSnippet = $state(null);
	let snippetToDelete = $state(null);
	let showRemoveModal = $state(false);
	let searchQuery = $state('');
	let selectedLabels = $state([]);
	let sortMode = $state(getUiSettings().snippetsSortMode || 'newest');

	// Get snippets from store (reactive)
	const snippets = $derived($snippetsStore.snippets || []);

	// Get all tags reactively from snippets store
	const allTags = $derived.by(() => {
		const allLabels = snippets.flatMap(s => s.labels || []);
		return [...new Set(allLabels)].sort();
	});

	// Layout mode for snippet list (grid/list), own setting
	let layoutMode = $state(getUiSettings().snippetsLayoutMode || 'grid');
	let isLayoutMenuOpen = $state(false);
	let layoutMenuEl;

	function handleLayoutButtonClick() {
		isLayoutMenuOpen = !isLayoutMenuOpen;
	}

	async function handleSelectLayout(mode) {
		layoutMode = mode;
		isLayoutMenuOpen = false;
		try {
			await updateUiSettings({ snippetsLayoutMode: mode });
		} catch (e) {
			console.warn('Failed to update home layout mode:', e);
		}
	}

	function handleLayoutClickOutside(event) {
		if (isLayoutMenuOpen && layoutMenuEl && !layoutMenuEl.contains(event.target)) {
			isLayoutMenuOpen = false;
		}
	}

	// Save sort mode when changed
	$effect(() => {
		updateUiSettings({ snippetsSortMode: sortMode }).catch(e =>
			console.warn('Failed to save sort mode:', e)
		);
	});

	function handleAdd() {
		editingSnippet = null;
		showPanel = true;
	}

	function handleEdit(snippet) {
		editingSnippet = snippet;
		showPanel = true;
	}

	function handleClosePanel() {
		showPanel = false;
		editingSnippet = null;
	}

	function handleSnippetSave(savedSnippet) {
		showPanel = false;
		editingSnippet = null;
		toast.success(`Snippet "${savedSnippet.name}" saved successfully`);
		// Store is reactive, so list will update automatically
	}

	function handleSnippetDelete(snippet) {
		// When delete is clicked from panel, show confirmation modal
		snippetToDelete = snippet;
		showRemoveModal = true;
	}

	function handleRemove(snippet) {
		// When remove is clicked from menu or list
		// If snippet is provided (from list), use it; otherwise use editingSnippet (from menu)
		const snippetToRemove = snippet || editingSnippet;
		if (snippetToRemove) {
			snippetToDelete = snippetToRemove;
			showRemoveModal = true;
		}
	}

	async function handleConfirmRemove() {
		if (snippetToDelete) {
			try {
				await deleteSnippet(snippetToDelete.id);
				toast.success(`Snippet "${snippetToDelete.name}" deleted`);
				// Close panel if deleting the currently editing snippet
				if (editingSnippet?.id === snippetToDelete.id) {
					showPanel = false;
					editingSnippet = null;
				}
				snippetToDelete = null;
				showRemoveModal = false;
			} catch (error) {
				console.error('Failed to delete snippet:', error);
				toast.error('Failed to delete snippet');
			}
		}
	}

	function handleCancelRemove() {
		showRemoveModal = false;
		snippetToDelete = null;
	}
</script>

<svelte:window onclick={handleLayoutClickOutside} />

<ContentWithPanel
	{showPanel}
	showMenu={!!editingSnippet}
	onclose={handleClosePanel}
	onremove={handleRemove}
>
	{#snippet content()}
		<div class="flex flex-col h-full">
			<!-- Header Section -->
			<div class="flex flex-col gap-3 items-start bg-bg-secondary p-3 w-full">
				<!-- Search Input -->
				<SearchInput bind:value={searchQuery} placeholder="Find a snippet" class="w-full" />

				<!-- Layout toggle + Tag Filter Icon -->
				<div class="flex items-center justify-between w-full">
					<div class="flex-1"></div>
					<div class="flex items-center gap-2">
						<!-- Layout toggle icon (grid/list) - same row as tag filter -->
						<div class="relative" bind:this={layoutMenuEl}>
							<button
								type="button"
								onclick={handleLayoutButtonClick}
								class="p-2 rounded-lg transition-colors border border-transparent hover:border-tab-active-text bg-bg-secondary hover:bg-bg-hover text-text-primary hover:text-tab-active-text flex items-center justify-center gap-1.5"
								title="Switch layout"
							>
								{#if layoutMode === 'grid'}
									<LayoutGrid size={16} />
								{:else}
									<List size={16} />
								{/if}
							</button>

							{#if isLayoutMenuOpen}
								<div
									class="absolute right-0 top-full mt-2 z-50 w-40 bg-bg-secondary border border-border rounded-lg shadow-xl py-1"
								>
									<button
										type="button"
										onclick={() => handleSelectLayout('grid')}
										class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-bg-hover text-text-secondary"
									>
										<LayoutGrid size={14} class="text-text-secondary" />
										<span>Grid view</span>
									</button>
									<button
										type="button"
										onclick={() => handleSelectLayout('list')}
										class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-bg-hover text-text-secondary"
									>
										<List size={14} class="text-text-secondary" />
										<span>List view</span>
									</button>
								</div>
							{/if}
						</div>

						<SortIcon bind:sortMode />
						<TagFilterIcon {allTags} bind:selectedTags={selectedLabels} />
					</div>
				</div>
			</div>

			<!-- Content Section -->
			<ScrollArea class="flex-1">
				<div class="p-6">
					<SnippetPageList
						{editingSnippet}
						{searchQuery}
						{selectedLabels}
						{layoutMode}
						{sortMode}
						onadd={handleAdd}
						onedit={handleEdit}
						onremove={handleRemove}
					/>
				</div>
			</ScrollArea>
		</div>
	{/snippet}

	{#snippet panel()}
		<SnippetPanel {editingSnippet} onsave={handleSnippetSave} ondelete={handleSnippetDelete} />
	{/snippet}
</ContentWithPanel>

<!-- Delete Confirmation Modal -->
<Modal bind:open={showRemoveModal} size="sm">
	<ModalHeader title="Delete Snippet" onclose={handleCancelRemove} />
	<ModalBody>
		<p class="text-white/80">
			Are you sure you want to delete the snippet <strong class="text-white"
				>"{snippetToDelete?.name}"</strong
			>?
		</p>
		<p class="text-white/60 text-sm mt-2">This action cannot be undone.</p>
	</ModalBody>
	<ModalFooter>
		<Button variant="ghost" onclick={handleCancelRemove}>Cancel</Button>
		<Button variant="danger" onclick={handleConfirmRemove}>Delete</Button>
	</ModalFooter>
</Modal>
