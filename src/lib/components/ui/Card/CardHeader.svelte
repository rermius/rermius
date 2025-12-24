<script>
	const { title = '', subtitle = '', children, subtitleSnippet } = $props();
</script>

<div class="mb-4">
	{#if title || children}
		<h3 class="text-lg font-semibold text-gray-100">
			{#if title}
				{title}
			{:else}
				{@render children()}
			{/if}
		</h3>
	{/if}

	{#if subtitle || subtitleSnippet}
		<p class="text-sm text-gray-400 mt-1">
			{#if subtitle}
				{subtitle}
			{:else}
				{@render subtitleSnippet()}
			{/if}
		</p>
	{/if}
</div>
