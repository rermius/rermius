<script>
	import { goto } from '$app/navigation';
	import { ItemCard } from '$lib/components/ui/Card';
	import { FileText } from 'lucide-svelte';
	import { Button, SearchInput, TagFilterIcon, SortIcon, LayoutIcon } from '$lib/components/ui';
	import {
		ConfirmRemoveModal,
		HostManagementLayout,
		ImportScanModal
	} from '$lib/components/features/hosts';
	import { useHostManagement } from '$lib/composables';
	import { hostsStore, deleteGroup, deleteHost, getHostTags } from '$lib/services';
	import { getUiSettings, updateUiSettings } from '$lib/services/app-settings.js';

	const {
		showPanel,
		panelType,
		editingHost,
		editingGroup,
		showRemoveModal,
		removeTarget,
		openAddHost,
		openEditHost,
		openAddGroup,
		openEditGroup,
		closePanel,
		requestRemoveGroup,
		requestRemoveHost,
		cancelRemove,
		confirmRemove
	} = useHostManagement({
		deleteGroupFn: deleteGroup,
		deleteHostFn: deleteHost,
		featureKey: 'hosts'
	});

	// Get data from hostsStore (reactive) - sorted by newest first
	const groups = $derived(
		($hostsStore.groups || [])
			.map(group => ({
				...group,
				hostCount: ($hostsStore.hosts || []).filter(h => h.groupId === group.id).length
			}))
			.sort((a, b) => {
				const dateA = new Date(a.updatedAt || a.createdAt || 0);
				const dateB = new Date(b.updatedAt || b.createdAt || 0);
				return dateB - dateA;
			})
	);

	const hosts = $derived($hostsStore.hosts || []);
	const allTags = $derived.by(() => {
		// Make reactive by accessing hostsStore
		const currentHosts = $hostsStore.hosts || [];
		const tags = currentHosts.flatMap(h => h.tags || []);
		return [...new Set(tags)].sort();
	});
	let searchQuery = $state('');
	let selectedTags = $state([]);
	let showSSHConfigModal = $state(false);

	// Layout mode for hosts list in sidebar home: 'grid' | 'list' (own setting)
	let layoutMode = $state(getUiSettings().hostLayoutMode || 'grid');
	let sortMode = $state(getUiSettings().hostSortMode || 'newest');

	// Save sort mode when changed
	$effect(() => {
		updateUiSettings({ hostSortMode: sortMode }).catch(e =>
			console.warn('Failed to save sort mode:', e)
		);
	});

	// Save layout mode when changed
	$effect(() => {
		updateUiSettings({ hostLayoutMode: layoutMode }).catch(e =>
			console.warn('Failed to save layout mode:', e)
		);
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

	// Filter and sort hosts based on search, tags and sortMode
	const filteredHosts = $derived.by(() => {
		let filtered = hosts;

		// Filter by search query
		if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(host => {
				const labelMatch = host.label?.toLowerCase().includes(query);
				const hostnameMatch = host.hostname?.toLowerCase().includes(query);
				const usernameMatch = host.username?.toLowerCase().includes(query);
				return labelMatch || hostnameMatch || usernameMatch;
			});
		}

		// Filter by tags
		if (selectedTags.length > 0) {
			filtered = filtered.filter(host => {
				const hostTags = host.tags || [];
				return selectedTags.some(tag => hostTags.includes(tag));
			});
		}

		// Sort based on sortMode
		return sortItems(filtered, sortMode);
	});

	const handleAddHost = openAddHost;
	const handleEditHost = openEditHost;
	const handleAddGroup = openAddGroup;
	const handleEditGroup = openEditGroup;

	function handleViewGroup(group) {
		goto(`/group/${group.id}`);
	}

	function handleHostSave(savedHost) {
		// Update editingHost to the saved host (for auto-save tracking)
		// Don't close panel - keep it open in edit mode
		if (savedHost) {
			openEditHost(savedHost);
		}
	}

	function handleGroupSave(event) {
		closePanel();
	}

	const handleClosePanel = closePanel;
	const handleRemove = () => {
		if ($panelType === 'group' && $editingGroup) {
			requestRemoveGroup($editingGroup);
		} else if ($panelType === 'host' && $editingHost) {
			requestRemoveHost($editingHost);
		}
	};
	const handleCancelRemove = cancelRemove;
	const handleConfirmRemove = () => confirmRemove();
</script>

<HostManagementLayout
	showPanel={$showPanel}
	panelType={$panelType}
	editingHost={$editingHost}
	editingGroup={$editingGroup}
	hosts={filteredHosts}
	showRemoveModal={$showRemoveModal}
	groupToRemove={null}
	onaddHost={handleAddHost}
	oneditHost={host => handleEditHost(host)}
	onclosePanel={handleClosePanel}
	onremove={handleRemove}
	onhostSave={handleHostSave}
	ongroupSave={handleGroupSave}
	oncancelRemove={handleCancelRemove}
	onconfirmRemove={handleConfirmRemove}
	{layoutMode}
>
	{#snippet header()}
		<div class="flex flex-col gap-3 w-full">
			<!-- Search Input -->
			<SearchInput bind:value={searchQuery} placeholder="Find a host" class="w-full" />

			<!-- Scan Button and Tag Filter Icon + Layout Toggle -->
			<div class="flex items-center justify-between w-full">
				<Button onclick={() => (showSSHConfigModal = true)} variant="secondary" size="sm">
					<FileText size={14} />
					<span>Scan SSH Config</span>
				</Button>

				<div class="flex items-center gap-2">
					<LayoutIcon bind:layoutMode />
					<SortIcon bind:sortMode />
					<TagFilterIcon {allTags} bind:selectedTags />
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-4">
			<!-- Groups Section -->
			<div class="flex flex-col gap-2">
				<h2 class="text-xs font-semibold text-white">Groups</h2>
				<div class={layoutMode === 'grid' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1'}>
					<!-- Add New Group Card -->
					<div class={layoutMode === 'grid' ? '' : 'w-full'}>
						<ItemCard
							label="Add a group..."
							subtitle=""
							icon="widgets-filled"
							isAddNew
							variant={layoutMode === 'list' ? 'list' : 'card'}
							onclick={handleAddGroup}
						/>
					</div>

					<!-- Existing Groups -->
					{#each groups as group (group.id)}
						<div class={layoutMode === 'grid' ? '' : 'w-full'}>
							<ItemCard
								label={group.name}
								subtitle="{group.hostCount} Hosts"
								icon="widgets-filled"
								showEdit={true}
								variant={layoutMode === 'list' ? 'list' : 'card'}
								isActive={$editingGroup?.id === group.id}
								onclick={() => handleViewGroup(group)}
								onedit={() => handleEditGroup(group)}
							/>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/snippet}
</HostManagementLayout>

<!-- Remove Group Confirmation Modal -->
<ConfirmRemoveModal
	open={$showRemoveModal}
	target={$removeTarget}
	on:cancel={handleCancelRemove}
	on:confirm={handleConfirmRemove}
/>

<!-- SSH Config Scan Modal -->
<ImportScanModal bind:open={showSSHConfigModal} />
