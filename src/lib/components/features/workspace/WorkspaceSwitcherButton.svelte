<!--
@component WorkspaceSwitcherButton
Button displaying current workspace with dropdown toggle
-->
<script>
	import { ChevronDown, Loader2 } from 'lucide-svelte';
	import WorkspaceAvatar from './WorkspaceAvatar.svelte';

	let {
		currentWorkspace = null,
		avatarUrl = null,
		isOpen = false,
		isSwitching = false,
		workspaceCount = 0,
		onClick = () => {}
	} = $props();
</script>

<button
	type="button"
	onclick={onClick}
	disabled={isSwitching}
	class="
		w-full px-4 py-3
		flex items-center gap-3
		hover:bg-(--color-bg-hover)
		transition-colors
		disabled:opacity-50 disabled:cursor-wait
	"
	aria-expanded={isOpen}
	aria-haspopup="true"
>
	<!-- Avatar -->
	<div class="relative flex-shrink-0">
		<WorkspaceAvatar workspace={currentWorkspace} {avatarUrl} size={40} />

		<!-- Switching indicator -->
		{#if isSwitching}
			<div
				class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full pointer-events-none"
			>
				<Loader2 size={16} class="animate-spin text-white" />
			</div>
		{/if}
	</div>

	<!-- Workspace Name -->
	<div class="flex-1 text-left min-w-0">
		<p class="text-sm font-medium text-text-primary truncate">
			{currentWorkspace?.name || 'No Workspace'}
		</p>
		<p class="text-xs text-text-secondary truncate">
			{workspaceCount} workspace{workspaceCount !== 1 ? 's' : ''}
		</p>
	</div>

	<!-- Chevron Icon -->
	<ChevronDown
		size={16}
		class="text-text-secondary hover:text-active transition-all {isOpen ? 'rotate-180' : ''}"
	/>
</button>
