<script>
	import { Button, ScrollArea } from '$lib/components/ui';

	const {
		// Simple title text for the header
		title,
		// Optional description text under the title
		description = '',
		// Optional custom header snippet. When provided, it fully replaces the default header content.
		header,
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
		onprimary
	} = $props();

	function handlePrimaryClick() {
		onprimary?.();
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header (fixed) -->
	<header class="p-3.5 bg-bg-secondary flex flex-col gap-1 shrink-0">
		{#if header}
			{@render header()}
		{:else}
			{#if title}
				<h2 class="text-xl font-bold text-white truncate">{title}</h2>
			{/if}

			{#if description}
				<p class="text-xs text-white/60">{description}</p>
			{/if}
		{/if}
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
