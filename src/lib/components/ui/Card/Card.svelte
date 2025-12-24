<script>
	const {
		hover = false,
		padding = true,
		bordered = true,
		onclick,
		children,
		...restProps
	} = $props();

	const classes = $derived(
		`
		bg-gray-800
		${bordered ? 'border border-gray-700' : ''}
		rounded-xl
		${hover ? 'hover:bg-gray-750 transition-colors cursor-pointer' : ''}
		${padding ? 'p-6' : ''}
		shadow-card
	`
			.trim()
			.replace(/\s+/g, ' ')
	);
</script>

<div class={classes} role="presentation" {onclick} {...restProps}>
	{@render children()}
</div>
