<script>
	const { title = '', showClose = true, children, onclose } = $props();

	function handleClose() {
		onclose?.();
	}
</script>

<div class="flex items-center justify-between p-6 border-b border-border bg-bg-secondary">
	<h3 class="text-xl font-semibold text-white">
		{#if title}
			{title}
		{:else}
			{@render children()}
		{/if}
	</h3>

	{#if showClose}
		<button
			type="button"
			class="text-white/70 hover:text-white transition-colors"
			onclick={handleClose}
			aria-label="Close modal"
		>
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	{/if}
</div>
