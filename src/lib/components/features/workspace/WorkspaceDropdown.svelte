<!--
@component WorkspaceDropdown
Dropdown menu containing workspace list and add button
-->
<script>
	import { Plus } from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';
	import WorkspaceListItem from './WorkspaceListItem.svelte';

	let {
		workspaces = [],
		currentWorkspaceId = null,
		avatarUrls = {},
		onWorkspaceClick = () => {},
		onWorkspaceEdit = () => {},
		onAddWorkspace = () => {}
	} = $props();
</script>

<div
	class="
		absolute bottom-full left-0 right-0 mb-1
		bg-(--color-bg-secondary)
		border border-border
		rounded-lg
		shadow-xl
		overflow-hidden
		z-50
	"
>
	<!-- Header -->
	<div class="px-4 py-2 border-b border-border">
		<p class="text-xs font-semibold text-text-secondary uppercase tracking-wide">Workspaces</p>
	</div>

	<!-- Workspace List -->
	<ScrollArea class="max-h-80">
		{#each workspaces as workspace (workspace.id)}
			<WorkspaceListItem
				{workspace}
				avatarUrl={avatarUrls[workspace.id]}
				isActive={workspace.id === currentWorkspaceId}
				onClick={() => onWorkspaceClick(workspace)}
				onEdit={onWorkspaceEdit}
			/>
		{/each}
	</ScrollArea>

	<!-- Add Workspace Button -->
	<div class="border-t border-border">
		<button
			type="button"
			onclick={onAddWorkspace}
			class="
				w-full px-4 py-3
				flex items-center gap-3
				hover:bg-(--color-bg-hover)
				transition-colors
				group
			"
		>
			<div
				class="w-8 h-8 rounded-full bg-active/10 flex items-center justify-center flex-shrink-0 group-hover:bg-active/20 transition-colors"
			>
				<Plus size={16} class="text-active" />
			</div>
			<span class="text-sm font-medium text-active">Add Workspace</span>
		</button>
	</div>
</div>
