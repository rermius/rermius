<script>
	const { title = '', description = '', children } = $props();
</script>

<div class="form-group mb-6">
	{#if title}
		<h3 class="text-lg font-semibold text-gray-100 mb-2">{title}</h3>
	{/if}

	{#if description}
		<p class="text-sm text-gray-400 mb-4">{description}</p>
	{/if}

	<div class="space-y-4">
		{@render children()}
	</div>
</div>
