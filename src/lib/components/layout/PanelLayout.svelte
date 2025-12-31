<script>
	import { Button, ScrollArea } from '$lib/components/ui';
	import { Pencil, Loader2, Check, AlertCircle, MoreHorizontal, X, Trash2 } from 'lucide-svelte';

	const {
		// Simple title text for the header
		title,
		// Optional description text under the title
		description = '',
		// Optional custom header left content (replaces title/description)
		headerLeft,
		// Optional custom header right content (appears after status icon, menu, close)
		headerRight,
		// Main scrollable content snippet (required)
		content,
		// Optional custom footer snippet. When provided, it overrides the default primary button.
		footer,
		// Whether to render default footer button (when no custom footer is provided)
		showPrimaryButton = false,
		// Default primary action label when using built‑in button
		primaryLabel = 'Save',
		// Disable state for built‑in button
		primaryDisabled = false,
		// Called when built‑in primary button is clicked
		onprimary,
		// Status for auto-save visual feedback
		saveStatus = 'idle', // 'idle' | 'editing' | 'saving' | 'saved' | 'error'
		// Optional menu button handler (shows delete option)
		onmenu,
		// Optional close button handler
		onclose,
		// Show menu button (three dots)
		showMenu = false,
		// Show close button
		showClose = false
	} = $props();

	let dropdownOpen = $state(false);

	function handlePrimaryClick() {
		onprimary?.();
	}

	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}

	function handleDelete() {
		onmenu?.();
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

<div class="flex flex-col h-full">
	<!-- Header (fixed) - Unified structure with auto status icon -->
	<header class="p-3.5 bg-bg-secondary flex items-center justify-between gap-3 shrink-0">
		<!-- Left section: Title or custom content -->
		<div class="flex flex-col gap-1 flex-1 min-w-0">
			{#if headerLeft}
				{@render headerLeft()}
			{:else}
				{#if title}
					<h2 class="text-xl font-bold text-white truncate">{title}</h2>
				{/if}

				{#if description}
					<p class="text-xs text-white/60">{description}</p>
				{/if}
			{/if}
		</div>

		<!-- Right section: Status icon + Menu + Close + Custom -->
		<div class="flex items-center gap-2 shrink-0">
			<!-- 1. Status Icon (Auto) -->
			{#if saveStatus !== 'idle'}
				<div class="flex items-center gap-1.5 text-xs">
					{#if saveStatus === 'editing'}
						<Pencil size={14} />
					{:else if saveStatus === 'saving'}
						<Loader2 size={14} class="animate-spin" />
					{:else if saveStatus === 'saved'}
						<Check size={14} class="text-active" />
					{:else if saveStatus === 'error'}
						<AlertCircle size={14} />
					{/if}
				</div>
			{/if}

			<!-- 2. Menu Button (Three Dots) with Dropdown -->
			{#if showMenu}
				<div class="relative dropdown-container">
					<button
						type="button"
						onclick={toggleDropdown}
						class="text-text-secondary hover:text-white transition-colors p-1 rounded hover:bg-white/10"
						aria-label="Menu"
					>
						<MoreHorizontal size={16} />
					</button>

					{#if dropdownOpen}
						<div
							class="absolute right-0 top-full mt-1 w-40 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 z-50"
						>
							<button
								type="button"
								onclick={handleDelete}
								class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-bg-hover text-text-secondary hover:text-red-400 transition-colors"
							>
								<Trash2 size={16} />
								<span>Delete</span>
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<!-- 3. Close Button -->
			{#if showClose}
				<button
					type="button"
					onclick={onclose}
					class="text-text-secondary hover:text-white transition-colors p-1 rounded hover:bg-white/10"
					aria-label="Close"
				>
					<X size={16} />
				</button>
			{/if}

			<!-- 4. Custom header right content -->
			{#if headerRight}
				{@render headerRight()}
			{/if}
		</div>
	</header>

	<!-- Scrollable content -->
	<ScrollArea class="flex-1 bg-bg-tertiary">
		<div class="p-4">
			{@render content?.()}
		</div>
	</ScrollArea>

	<!-- Footer (fixed) -->
	<footer class="p-3.5 bg-bg-secondary shrink-0">
		{#if footer}
			{@render footer()}
		{:else if showPrimaryButton}
			<Button variant="success" fullWidth onclick={handlePrimaryClick} disabled={primaryDisabled}>
				{primaryLabel}
			</Button>
		{/if}
	</footer>
</div>
