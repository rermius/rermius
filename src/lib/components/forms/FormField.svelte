<script>
	const { label = '', error = '', required = false, htmlFor = '', hint = '', children } = $props();
</script>

<div class="form-field mb-4">
	{#if label}
		<label for={htmlFor} class="block text-sm font-medium text-gray-200 mb-1">
			{label}
			{#if required}
				<span class="text-red-500">*</span>
			{/if}
		</label>
	{/if}

	{#if hint}
		<p class="text-xs text-gray-400 mb-1">{hint}</p>
	{/if}

	{@render children()}

	{#if error}
		<p class="text-red-500 text-sm mt-1 flex items-center gap-1">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			{error}
		</p>
	{/if}
</div>
