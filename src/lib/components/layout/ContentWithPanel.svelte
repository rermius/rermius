<script>
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { MoreHorizontal, X } from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';

	const {
		/** Show/hide right panel */
		showPanel = false,
		/** Show menu dropdown */
		showMenu = true,
		content,
		panel,
		header,
		onclose,
		onremove
	} = $props();

	let dropdownOpen = $state(false);

	function handleClose() {
		onclose?.();
		dropdownOpen = false;
	}

	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}

	function handleRemove() {
		onremove?.();
		dropdownOpen = false;
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (dropdownOpen && !event.target.closest('.dropdown-container')) {
			dropdownOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="flex h-full flex-col">
	<!-- Header (if provided) -->
	{#if header}
		<div class="flex flex-col gap-4.5 items-start bg-bg-secondary p-3">
			{@render header()}
		</div>
	{/if}

	<!-- Main Content (Left) -->
	<div class="flex-1 flex overflow-hidden">
		<ScrollArea class="flex-1">
			{@render content()}
		</ScrollArea>

		<!-- Right Panel (Slides in from right) -->
		{#if showPanel}
			<div
				class="border-l border-border w-[350px] shrink-0 flex flex-col h-full overflow-hidden bg-[var(--color-bg-elevated)]"
				transition:slide={{ duration: 300, easing: quintOut, axis: 'x' }}
			>
				{@render panel()}
			</div>
		{/if}
	</div>
</div>
