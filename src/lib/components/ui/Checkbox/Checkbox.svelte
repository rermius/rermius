<script>
	let {
		checked = $bindable(false),
		label = '',
		disabled = false,
		onchange,
		class: className = '',
		...restProps
	} = $props();

	function handleChange(e) {
		if (disabled) return;
		checked = e.target.checked;
		onchange?.(e);
	}
</script>

<label
	class="flex items-center gap-2 cursor-pointer {disabled
		? 'opacity-50 cursor-not-allowed'
		: ''} {className}"
>
	<input
		type="checkbox"
		{checked}
		{disabled}
		onchange={handleChange}
		class="w-4 h-4 rounded bg-border border border-white/20 text-primary focus:ring-1 focus:ring-primary focus:ring-offset-0 focus:ring-offset-transparent"
		{...restProps}
	/>
	{#if label}
		<span class="text-sm text-white/80">{label}</span>
	{/if}
</label>
