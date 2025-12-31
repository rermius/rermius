<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ItemCard } from '$lib/components/ui/Card';
	import { ChevronRight } from 'lucide-svelte';
	import { SortIcon, LayoutIcon } from '$lib/components/ui';
	import { ConfirmRemoveModal, HostManagementLayout } from '$lib/components/features/hosts';
	import { useHostManagement } from '$lib/composables';
	import { hostsStore, deleteGroup, deleteHost } from '$lib/services';
	import { getUiSettings, updateUiSettings } from '$lib/services/app-settings.js';

	// Get groupId from URL params
	const groupId = $derived($page.params.groupId);

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
		featureKey: 'group'
	});

	// Get current group
	const currentGroup = $derived(($hostsStore.groups || []).find(g => g.id === groupId));

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

	// Get hosts for this group - sorted based on sortMode
	const hosts = $derived(
		sortItems(
			($hostsStore.hosts || []).filter(h => h.groupId === groupId),
			sortMode
		)
	);

	// Redirect to home if group not found
	$effect(() => {
		if (groupId && !currentGroup && $hostsStore.groups?.length > 0) {
			goto('/');
		}
	});

	const handleAddHost = openAddHost;
	const handleEditHost = openEditHost;
	const handleEditGroup = () => openEditGroup(currentGroup);

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
	const handleConfirmRemove = () =>
		confirmRemove({
			onAfterDelete: () => goto('/')
		});

	function handleBackToAllHosts() {
		goto('/');
	}

	// Layout mode for hosts list (grid/list), own setting
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
</script>

<HostManagementLayout
	showPanel={$showPanel}
	panelType={$panelType}
	editingHost={$editingHost}
	editingGroup={$editingGroup}
	{hosts}
	showRemoveModal={$showRemoveModal}
	groupToRemove={null}
	defaultGroupId={groupId}
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
		<div class="flex items-center justify-between w-full">
			<button
				onclick={handleBackToAllHosts}
				class="flex items-center gap-2 text-xs text-active hover:text-active/80 transition-colors"
			>
				<span>All hosts</span>
				{#if currentGroup}
					<ChevronRight size={12} class="text-white/50" />
					<span class="text-white">{currentGroup.name}</span>
				{/if}
			</button>

			<div class="flex items-center gap-2">
				<LayoutIcon bind:layoutMode />
				<SortIcon bind:sortMode />
			</div>
		</div>
	{/snippet}

	{#snippet content()}
		{#if currentGroup}
			<div class="flex flex-col gap-4">
				<!-- Current Group Card -->
				<div class="flex flex-col gap-2">
					<h2 class="text-xs font-semibold text-white">Group</h2>
					<div class={layoutMode === 'grid' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1'}>
						<div class={layoutMode === 'grid' ? '' : 'w-full'}>
							<ItemCard
								label={currentGroup.name}
								subtitle="{hosts.length} Hosts"
								icon="widgets-filled"
								showEdit={true}
								variant={layoutMode === 'list' ? 'list' : 'card'}
								isActive={$editingGroup?.id === currentGroup.id}
								onedit={handleEditGroup}
							/>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-center h-full">
				<p class="text-white/50">Group not found</p>
			</div>
		{/if}
	{/snippet}
</HostManagementLayout>

<!-- Remove Group Confirmation Modal -->
<ConfirmRemoveModal
	open={$showRemoveModal}
	target={$removeTarget}
	on:cancel={handleCancelRemove}
	on:confirm={handleConfirmRemove}
/>
