<script>
	import { workspaceStore } from '$lib/stores';
	import { switchWorkspace } from '$lib/services/workspaces.js';
	import { loadAvatarAsDataUrl } from '$lib/utils/avatar-handler.js';
	import * as avatarCache from '$lib/utils/avatar-cache.js';
	import { WorkspaceCreationModal } from '$lib/components/features/workspace';
	import WorkspaceSwitcherButton from './WorkspaceSwitcherButton.svelte';
	import WorkspaceDropdown from './WorkspaceDropdown.svelte';
	import { useToast } from '$lib/composables/useToast.svelte.js';
	import { clickOutside } from '$lib/actions/click-outside.js';
	import { onMount } from 'svelte';

	const toast = useToast();

	let isOpen = $state(false);
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editingWorkspace = $state(null);
	let avatarUrls = $state({});
	let isSwitching = $state(false);

	const currentWorkspace = $derived(
		$workspaceStore.workspaces.find(w => w.id === $workspaceStore.currentWorkspaceId)
	);

	// Restore avatarUrls from cache on mount
	onMount(() => {
		const cachedKeys = avatarCache.getCacheKeys();
		if (cachedKeys.length > 0 && Object.keys(avatarUrls).length === 0) {
			const restored = {};
			for (const key of cachedKeys) {
				restored[key] = avatarCache.getAvatar(key);
			}
			avatarUrls = restored;
		}
	});

	// Load avatars for all workspaces
	async function loadWorkspaceAvatar(workspace) {
		if (!workspace?.avatarPath) {
			return null;
		}

		if (avatarCache.hasAvatar(workspace.id)) {
			const cached = avatarCache.getAvatar(workspace.id);
			if (!avatarUrls[workspace.id]) {
				avatarUrls = { ...avatarUrls, [workspace.id]: cached };
			}
			return cached;
		}

		try {
			const url = await loadAvatarAsDataUrl(workspace.avatarPath);
			avatarCache.setAvatar(workspace.id, url);
			avatarUrls = { ...avatarUrls, [workspace.id]: url };
			return url;
		} catch (error) {
			console.error('[ProfileSwitcher] Failed to load avatar:', error);
			return null;
		}
	}

	// Auto-load avatars when workspaces change
	$effect(() => {
		const workspaces = $workspaceStore.workspaces;

		for (const workspace of workspaces) {
			const hasCache = avatarCache.hasAvatar(workspace.id);
			const hasState = !!avatarUrls[workspace.id];

			if (workspace.avatarPath && !hasCache) {
				loadWorkspaceAvatar(workspace);
			} else if (workspace.avatarPath && hasCache && !hasState) {
				const cached = avatarCache.getAvatar(workspace.id);
				avatarUrls = { ...avatarUrls, [workspace.id]: cached };
			} else if (!workspace.avatarPath && hasCache) {
				avatarCache.deleteAvatar(workspace.id);
				avatarUrls = { ...avatarUrls };
				delete avatarUrls[workspace.id];
			}
		}
	});

	async function handleWorkspaceClick(workspace) {
		if (workspace.id === $workspaceStore.currentWorkspaceId) {
			isOpen = false;
			return;
		}

		try {
			isSwitching = true;
			isOpen = false;
			toast.info(`Switching to ${workspace.name}...`);
			await switchWorkspace(workspace.id);
			toast.success(`Switched to ${workspace.name}`);
		} catch (error) {
			toast.error(`Failed to switch workspace: ${error.message}`);
		} finally {
			isSwitching = false;
		}
	}

	async function handleWorkspaceUpdated(workspaceData) {
		const { updateWorkspace } = await import('$lib/services/workspaces.js');
		await updateWorkspace(editingWorkspace.id, workspaceData);

		const updated = $workspaceStore.workspaces.find(w => w.id === editingWorkspace.id);
		if (updated?.avatarPath) {
			avatarCache.deleteAvatar(updated.id); // Force reload
			await loadWorkspaceAvatar(updated);
		} else {
			avatarCache.deleteAvatar(editingWorkspace.id);
			avatarUrls = { ...avatarUrls };
			delete avatarUrls[editingWorkspace.id];
		}

		toast.success(`Updated workspace: ${workspaceData.name}`);
		showEditModal = false;
		editingWorkspace = null;
	}

	async function handleWorkspaceCreated(workspaceData) {
		const { addWorkspace } = await import('$lib/services/workspaces.js');
		const newWorkspace = await addWorkspace(workspaceData);
		toast.success(`Created workspace: ${newWorkspace.name}`);
		await switchWorkspace(newWorkspace.id);
	}
</script>

<svelte:window onkeydown={e => e.key === 'Escape' && isOpen && (isOpen = false)} />

<div class="relative" use:clickOutside={() => (isOpen = false)}>
	<WorkspaceSwitcherButton
		{currentWorkspace}
		avatarUrl={currentWorkspace ? avatarUrls[currentWorkspace.id] : null}
		{isOpen}
		{isSwitching}
		workspaceCount={$workspaceStore.workspaces.length}
		onClick={() => (isOpen = !isOpen)}
	/>

	{#if isOpen}
		<WorkspaceDropdown
			workspaces={$workspaceStore.workspaces}
			currentWorkspaceId={$workspaceStore.currentWorkspaceId}
			{avatarUrls}
			onWorkspaceClick={handleWorkspaceClick}
			onWorkspaceEdit={(w, e) => {
				e.stopPropagation();
				isOpen = false;
				editingWorkspace = w;
				showEditModal = true;
			}}
			onAddWorkspace={() => {
				isOpen = false;
				showCreateModal = true;
			}}
		/>
	{/if}
</div>

<WorkspaceCreationModal
	bind:open={showCreateModal}
	editMode={false}
	onConfirm={handleWorkspaceCreated}
/>

<WorkspaceCreationModal
	bind:open={showEditModal}
	editMode={true}
	workspaceData={editingWorkspace}
	onConfirm={handleWorkspaceUpdated}
	onCancel={() => {
		showEditModal = false;
		editingWorkspace = null;
	}}
/>
