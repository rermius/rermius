<script>
	import { ContentWithPanel } from '$lib/components/layout';
	import { ItemCard } from '$lib/components/ui/Card';
	import { Modal, ModalHeader, ModalBody, ModalFooter } from '$lib/components/ui/Modal';
	import { Button, SearchInput, TagFilterIcon, SortIcon, LayoutIcon, ScrollArea, ContextMenu } from '$lib/components/ui';
	import { KeyPanel, KeyScanModal } from '$lib/components/features/keychain';
	import { keychainStore, deleteKey, exportKey } from '$lib/services';
	import { panelStore } from '$lib/stores';
	import { FolderOpen, Pencil, Download, Trash2 } from 'lucide-svelte';
	import { getUiSettings, updateUiSettings } from '$lib/services/app-settings.js';
	import { useToast } from '$lib/composables';

	const toast = useToast();

	let editingKey = $state(null);
	let showRemoveModal = $state(false);
	let keyToRemove = $state(null);
	let showScanModal = $state(false);
	let searchQuery = $state('');
	let selectedTags = $state([]);

	// Subscribe to keychain store
	const keys = $derived($keychainStore.keys);

	// Get all tags for filter (if keys have tags)
	const allTags = $derived.by(() => {
		const allLabels = (keys || []).flatMap(k => k.tags || []);
		return [...new Set(allLabels)].sort();
	});

	// Sort function based on sortMode
	function sortItems(items, mode) {
		return [...items].sort((a, b) => {
			switch (mode) {
				case 'a-z':
					return (a.label || '').localeCompare(b.label || '');
				case 'z-a':
					return (b.label || '').localeCompare(a.label || '');
				case 'oldest': {
					const dateA = new Date(a.metadata?.createdAt || 0);
					const dateB = new Date(b.metadata?.createdAt || 0);
					return dateA - dateB;
				}
				case 'newest':
				default: {
					const dateA = new Date(a.metadata?.updatedAt || a.metadata?.createdAt || 0);
					const dateB = new Date(b.metadata?.updatedAt || b.metadata?.createdAt || 0);
					return dateB - dateA;
				}
			}
		});
	}

	// Filter and sort keys based on search, tags and sortMode
	const filteredKeys = $derived.by(() => {
		let filtered = keys;

		// Filter by search query
		if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(key => {
				const labelMatch = key.label?.toLowerCase().includes(query);
				const typeMatch = key.keyType?.toLowerCase().includes(query);
				return labelMatch || typeMatch;
			});
		}

		// Filter by tags
		if (selectedTags.length > 0) {
			filtered = filtered.filter(key => {
				const keyTags = key.tags || [];
				return selectedTags.some(tag => keyTags.includes(tag));
			});
		}

		// Sort based on sortMode
		return sortItems(filtered, sortMode);
	});

	// Get panel state from panelStore
	const panelState = $derived(
		$panelStore.keychain || { showPanel: false, panelType: 'key', editingId: null }
	);
	const showNewKeyPanel = $derived(panelState.showPanel);

	// Restore editing key when panel opens
	$effect(() => {
		if (showNewKeyPanel && panelState.editingId) {
			editingKey = keys.find(k => k.id === panelState.editingId) || null;
		} else if (!showNewKeyPanel) {
			editingKey = null;
		}
	});

	function handleAddKey() {
		editingKey = null;
		panelStore.openPanel('keychain', 'key', null);
	}

	function handleEditKey(key) {
		editingKey = key;
		panelStore.openPanel('keychain', 'key', key?.id || null);
	}

	function handleKeyImport(event) {
		// Close panel after successful save
		panelStore.closePanel('keychain');
		editingKey = null;
	}

	function handleClosePanel() {
		panelStore.closePanel('keychain');
		editingKey = null;
	}

	function handleRemove() {
		if (editingKey) {
			keyToRemove = editingKey;
			showRemoveModal = true;
		}
	}

	async function handleConfirmRemove() {
		if (keyToRemove) {
			try {
				await deleteKey(keyToRemove.id);

				// Close modal and panel
				showRemoveModal = false;
				panelStore.closePanel('keychain');
				editingKey = null;
				keyToRemove = null;
			} catch (error) {
				console.error('Failed to remove key:', error);
			}
		}
	}

	function handleCancelRemove() {
		showRemoveModal = false;
		keyToRemove = null;
	}

	function handleScanFolder() {
		showScanModal = true;
	}

	function handleImportComplete(summary) {
		// Keys will automatically update via store reactivity
		console.log('Import completed:', summary);
	}

	// Layout mode for key list (grid/list), own setting
	let layoutMode = $state(getUiSettings().keychainLayoutMode || 'grid');
	let sortMode = $state(getUiSettings().keychainSortMode || 'newest');

	// Context menu state
	let contextMenuOpen = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });
	let contextMenuTarget = $state(null);

	// Context menu items configuration
	const keychainMenuItems = [
		{
			id: 'edit',
			label: 'Edit',
			icon: Pencil,
			action: 'edit'
		},
		{
			id: 'export',
			label: 'Export',
			icon: Download,
			action: 'export'
		},
		{ id: 'divider-1', divider: true },
		{
			id: 'remove',
			label: 'Remove',
			icon: Trash2,
			action: 'remove',
			variant: 'danger'
		}
	];

	// Save sort mode when changed
	$effect(() => {
		updateUiSettings({ keychainSortMode: sortMode }).catch(e =>
			console.warn('Failed to save sort mode:', e)
		);
	});

	// Save layout mode when changed
	$effect(() => {
		updateUiSettings({ keychainLayoutMode: layoutMode }).catch(e =>
			console.warn('Failed to save layout mode:', e)
		);
	});

	function handleKeyContextMenu(key, { x, y }) {
		contextMenuTarget = key;
		contextMenuPosition = { x, y };
		contextMenuOpen = true;
	}

	async function handleContextMenuAction(item) {
		const key = contextMenuTarget;
		if (!key) return;

		switch (item.action) {
			case 'edit':
				handleEditKey(key);
				break;
			case 'export':
				try {
					const success = await exportKey(key.id);
					if (success) {
						toast.success(`Key "${key.label}" exported successfully`);
					}
				} catch (error) {
					console.error('Failed to export key:', error);
					toast.error('Failed to export key');
				}
				break;
			case 'remove':
				handleEditKey(key); // Open panel for the key first
				handleRemove(); // Then trigger remove
				break;
		}
	}

	function handleCloseContextMenu() {
		contextMenuOpen = false;
		contextMenuTarget = null;
	}
</script>

<ContentWithPanel showPanel={showNewKeyPanel} onclose={handleClosePanel} onremove={handleRemove}>
	{#snippet content()}
		<div class="flex flex-col h-full">
			<!-- Header Section -->
			<div class="flex flex-col gap-3 items-start bg-bg-secondary p-3">
				<!-- Search Input -->
				<SearchInput bind:value={searchQuery} placeholder="Find a key" class="w-full" />

				<!-- Scan Button, Layout Toggle, and Tag Filter Icon -->
				<div class="flex items-center justify-between w-full">
					<Button onclick={handleScanFolder} variant="secondary" size="sm">
						<FolderOpen size={14} />
						<span>Scan Folder</span>
					</Button>

					<div class="flex items-center gap-2">
						<LayoutIcon bind:layoutMode />
						<SortIcon bind:sortMode />
						<TagFilterIcon {allTags} bind:selectedTags />
					</div>
				</div>
			</div>

			<!-- Content Section -->
			<ScrollArea class="flex-1">
				<div class="p-6">
					<!-- Key Cards layout (grid/list) -->
					<div class={layoutMode === 'grid' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1'}>
						<!-- Add New Key Card -->
						<ItemCard
							label="Add a label..."
							subtitle=""
							icon="key-filled"
							isAddNew
							variant={layoutMode === 'list' ? 'list' : 'card'}
							onclick={handleAddKey}
						/>

						<!-- Existing Keys -->
						{#each filteredKeys as key (key.id)}
							<div class={layoutMode === 'grid' ? '' : 'w-full'}>
								<ItemCard
									label={key.label}
									subtitle={key.keyType}
									icon="key-filled"
									showEdit={true}
									variant={layoutMode === 'list' ? 'list' : 'card'}
									isActive={editingKey?.id === key.id || contextMenuTarget?.id === key.id}
									onedit={() => handleEditKey(key)}
									oncontextmenu={(pos) => handleKeyContextMenu(key, pos)}
								/>
							</div>
						{/each}
					</div>
				</div>
			</ScrollArea>
		</div>
	{/snippet}

	{#snippet panel()}
		<KeyPanel
			{editingKey}
			onclose={handleClosePanel}
			onmenu={handleRemove}
			on:import={handleKeyImport}
		/>
	{/snippet}
</ContentWithPanel>

<!-- Remove Confirmation Modal -->
<Modal bind:open={showRemoveModal} size="sm">
	<ModalHeader title="Remove Key" onclose={handleCancelRemove} />
	<ModalBody>
		<p class="text-white/80">
			Are you sure you want to remove the key <strong class="text-white"
				>"{keyToRemove?.label}"</strong
			>?
		</p>
		<p class="text-white/60 text-sm mt-2">This action cannot be undone.</p>
	</ModalBody>
	<ModalFooter>
		<Button variant="ghost" onclick={handleCancelRemove}>Cancel</Button>
		<Button variant="danger" onclick={handleConfirmRemove}>Remove</Button>
	</ModalFooter>
</Modal>

<!-- Scan Folder Modal -->
<KeyScanModal bind:open={showScanModal} onImportComplete={handleImportComplete} />

<!-- Context Menu -->
{#if contextMenuTarget}
	<ContextMenu
		open={contextMenuOpen}
		position={contextMenuPosition}
		items={keychainMenuItems}
		onSelect={handleContextMenuAction}
		onClose={handleCloseContextMenu}
	/>
{/if}
