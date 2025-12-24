<!--
@component WorkspaceListItem
Individual workspace item in the dropdown list
-->
<script>
	import { Pencil } from 'lucide-svelte';
	import WorkspaceAvatar from './WorkspaceAvatar.svelte';

	let {
		workspace = null,
		avatarUrl = null,
		isActive = false,
		onClick = () => {},
		onEdit = () => {}
	} = $props();
</script>

{#if workspace}
	<div
		class="w-full px-4 py-3 flex items-center gap-3 hover:bg-(--color-bg-hover) transition-colors group
			{isActive ? 'bg-(--color-bg-tertiary)' : ''}
		"
	>
		<!-- Clickable area for switching -->
		<button type="button" onclick={onClick} class="flex items-center gap-3 flex-1 min-w-0">
			<!-- Avatar with check indicator -->
			<WorkspaceAvatar {workspace} {avatarUrl} size={32} showActiveIndicator={true} {isActive} />

			<!-- Name -->
			<div class="flex-1 text-left min-w-0">
				<p class="text-sm font-medium text-text-primary truncate">
					{workspace.name}
				</p>
			</div>
		</button>

		<!-- Edit Button -->
		<button
			type="button"
			onclick={e => {
				e.stopPropagation();
				onEdit(workspace, e);
			}}
			class="p-1.5 opacity-70 hover:opacity-100 hover:bg-(--color-bg-tertiary) rounded transition-all flex-shrink-0"
			aria-label="Edit workspace"
			title="Edit workspace"
		>
			<Pencil size={14} class="text-text-secondary hover:text-active" />
		</button>
	</div>
{/if}
