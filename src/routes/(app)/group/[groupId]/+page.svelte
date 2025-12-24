<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ItemCard } from '$lib/components/ui/Card';
	import { ChevronRight, LayoutGrid, List } from 'lucide-svelte';
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

	// Get hosts for this group
	const hosts = $derived(($hostsStore.hosts || []).filter(h => h.groupId === groupId));

	// Redirect to home if group not found
	$effect(() => {
		if (groupId && !currentGroup && $hostsStore.groups?.length > 0) {
			goto('/');
		}
	});

	const handleAddHost = openAddHost;
	const handleEditHost = openEditHost;
	const handleEditGroup = () => openEditGroup(currentGroup);

	function handleHostSave(event) {
		closePanel();
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
	let isLayoutMenuOpen = $state(false);
	let layoutMenuEl;

	function handleLayoutButtonClick() {
		isLayoutMenuOpen = !isLayoutMenuOpen;
	}

	async function handleSelectLayout(mode) {
		layoutMode = mode;
		isLayoutMenuOpen = false;
		try {
			await updateUiSettings({ hostLayoutMode: mode });
		} catch (e) {
			console.warn('Failed to update home layout mode:', e);
		}
	}

	function handleLayoutClickOutside(event) {
		if (isLayoutMenuOpen && layoutMenuEl && !layoutMenuEl.contains(event.target)) {
			isLayoutMenuOpen = false;
		}
	}
</script>

<svelte:window onclick={handleLayoutClickOutside} />

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

			<!-- Layout toggle icon (grid/list) for group page, same behavior as home sidebar -->
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
