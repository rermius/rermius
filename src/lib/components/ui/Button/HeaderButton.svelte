<script>
	const {
		variant = 'secondary', // 'primary' | 'secondary'
		children,
		onclick,
		...restProps
	} = $props();

	const classes = $derived(
		variant === 'primary'
			? 'px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-2'
			: 'px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600 transition-colors'
	);
</script>

<button class={classes} {onclick} {...restProps}>
	{@render children()}
</button>
