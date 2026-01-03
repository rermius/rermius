<!--
@component WorkspaceAvatar
Displays workspace avatar with fallback to initials
-->
<script>
	import { Check } from 'lucide-svelte';
	import { getWorkspaceInitials } from '$lib/services';

	let {
		workspace = null,
		avatarUrl = null,
		size = 32,
		showActiveIndicator = false,
		isActive = false
	} = $props();

	// Guard against undefined/null workspace
	const workspaceName = $derived(workspace?.name || '');
	const workspaceColor = $derived(workspace?.color || '#4A9FFF');
</script>

<div class="relative" style="width: {size}px; height: {size}px;">
	<div
		class="rounded-full overflow-hidden {size >= 40 ? 'border-2' : 'border'} border-border"
		style="width: {size}px; height: {size}px;"
	>
		{#if workspace}
			{#if avatarUrl}
				<img src={avatarUrl} alt="{workspaceName} avatar" class="w-full h-full object-cover" />
			{:else}
				<div
					class="w-full h-full flex items-center justify-center text-white font-semibold"
					style="background-color: {workspaceColor}; font-size: {size * 0.4}px;"
				>
					{getWorkspaceInitials(workspaceName)}
				</div>
			{/if}
		{:else}
			<!-- Fallback when workspace is null/undefined -->
			<div class="w-full h-full bg-(--color-bg-tertiary)"></div>
		{/if}
	</div>

	{#if workspace && showActiveIndicator && isActive}
		<div
			class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-active rounded-full flex items-center justify-center border-2 border-(--color-bg-secondary)"
		>
			<Check size={10} class="text-white" stroke-width={3} />
		</div>
	{/if}
</div>
