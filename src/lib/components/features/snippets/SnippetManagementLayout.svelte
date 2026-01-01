<script>
	import { ContentWithPanel } from '$lib/components/layout';
	import SnippetPanel from './SnippetPanel.svelte';
	import SnippetPageList from './SnippetPageList.svelte';
	import { deleteSnippet, duplicateSnippet, snippetsStore } from '$lib/services';
	import { useToast } from '$lib/composables';
	import { Modal, ModalHeader, ModalBody, ModalFooter } from '$lib/components/ui/Modal';
	import { Button, SearchInput, TagFilterIcon, SortIcon, LayoutIcon, ScrollArea, ContextMenu } from '$lib/components/ui';
	import { getUiSettings, updateUiSettings } from '$lib/services/app-settings.js';
	import { Play, ClipboardCopy, Pencil, Copy, Trash2 } from 'lucide-svelte';

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

	// Context menu state
	let contextMenuOpen = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });
	let contextMenuTarget = $state(null);

	// Context menu items configuration
	const snippetMenuItems = [
		{
			id: 'run',
			label: 'Run',
			icon: Play,
			action: 'run'
		},
		{
			id: 'paste',
			label: 'Paste',
			icon: ClipboardCopy,
			action: 'paste'
		},
		{ id: 'divider-1', divider: true },
		{
			id: 'edit',
			label: 'Edit',
			icon: Pencil,
			action: 'edit'
		},
		{
			id: 'duplicate',
			label: 'Duplicate',
			icon: Copy,
			action: 'duplicate'
		},
		{ id: 'divider-2', divider: true },
		{
			id: 'delete',
			label: 'Delete',
			icon: Trash2,
			action: 'delete',
			variant: 'danger'
		}
	];

	// Save sort mode when changed
	$effect(() => {
		updateUiSettings({ snippetsSortMode: sortMode }).catch(e =>
			console.warn('Failed to save sort mode:', e)
		);
	});

	// Save layout mode when changed
	$effect(() => {
		updateUiSettings({ snippetsLayoutMode: layoutMode }).catch(e =>
			console.warn('Failed to save layout mode:', e)
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

	function handleSnippetContextMenu(snippet, { x, y }) {
		contextMenuTarget = snippet;
		contextMenuPosition = { x, y };
		contextMenuOpen = true;
	}

	async function handleContextMenuAction(item) {
		const snippet = contextMenuTarget;
		if (!snippet) return;

		switch (item.action) {
			case 'run':
				// TODO: Implement run action (execute snippet in active terminal)
				console.log('Run snippet:', snippet.name);
				toast.info('Run action not yet implemented');
				break;
			case 'paste':
				// TODO: Implement paste action (paste to active terminal)
				console.log('Paste snippet:', snippet.name);
				toast.info('Paste action not yet implemented');
				break;
			case 'edit':
				handleEdit(snippet);
				break;
			case 'duplicate':
				try {
					const newSnippet = await duplicateSnippet(snippet.id);
					toast.success(`Snippet "${newSnippet.name}" created`);
				} catch (error) {
					console.error('Failed to duplicate snippet:', error);
					toast.error('Failed to duplicate snippet');
				}
				break;
			case 'delete':
				handleRemove(snippet);
				break;
		}
	}

	function handleCloseContextMenu() {
		contextMenuOpen = false;
		contextMenuTarget = null;
	}
</script>

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
						<LayoutIcon bind:layoutMode />
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
						{contextMenuTarget}
						{searchQuery}
						{selectedLabels}
						{layoutMode}
						{sortMode}
						onadd={handleAdd}
						onedit={handleEdit}
						onremove={handleRemove}
						oncontextmenu={handleSnippetContextMenu}
					/>
				</div>
			</ScrollArea>
		</div>
	{/snippet}

	{#snippet panel()}
		<SnippetPanel
			{editingSnippet}
			onsave={handleSnippetSave}
			ondelete={handleSnippetDelete}
			onclose={handleClosePanel}
			onmenu={handleRemove}
		/>
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

<!-- Context Menu -->
{#if contextMenuTarget}
	<ContextMenu
		open={contextMenuOpen}
		position={contextMenuPosition}
		items={snippetMenuItems}
		onSelect={handleContextMenuAction}
		onClose={handleCloseContextMenu}
	/>
{/if}
