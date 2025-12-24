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
				class="border-l border-border w-[350px] shrink-0 relative flex flex-col h-full overflow-hidden bg-[var(--color-bg-elevated)]"
				transition:slide={{ duration: 300, easing: quintOut, axis: 'x' }}
			>
				<!-- Header Buttons -->
				<div class="absolute top-4 right-4 z-10 flex items-center gap-1">
					<!-- Three Dot Menu -->
					{#if showMenu}
						<div class="relative dropdown-container">
							<button
								onclick={e => {
									e.stopPropagation();
									toggleDropdown();
								}}
								class="w-8 h-8 flex items-center justify-center hover:bg-(--color-bg-hover) rounded-lg transition-colors"
								aria-label="Menu"
							>
								<MoreHorizontal size={16} class="text-text-secondary hover:text-text-primary" />
							</button>

							<!-- Dropdown Menu -->
							{#if dropdownOpen}
								<div
									class="absolute right-0 mt-1 w-36 bg-(--color-bg-surface) rounded-lg shadow-lg border border-border overflow-hidden"
									transition:slide={{ duration: 200, easing: quintOut }}
								>
									<button
										onclick={handleRemove}
										class="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-error/20 hover:text-error transition-colors flex items-center gap-2"
									>
										<X size={14} />
										<span>Remove</span>
									</button>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Close Button -->
					<button
						onclick={handleClose}
						class="w-8 h-8 flex items-center justify-center hover:bg-(--color-bg-tertiary) rounded-lg transition-colors"
						aria-label="Close panel"
					>
						<X size={16} class="text-text-secondary hover:text-text-primary" />
					</button>
				</div>

				{@render panel()}
			</div>
		{/if}
	</div>
</div>
