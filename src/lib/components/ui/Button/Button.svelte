<script>
	const {
		variant = 'secondary', // 'primary' | 'secondary' | 'danger' | 'ghost'
		size = 'md', // 'sm' | 'md' | 'lg'
		disabled = false,
		type = 'button',
		fullWidth = false,
		children,
		onclick,
		...restProps
	} = $props();

	const variantClasses = {
		primary:
			'bg-(--color-bg-secondary) hover:bg-(--color-bg-hover) text-text-primary hover:text-[var(--color-tab-active-text)] hover:[&_svg]:text-[var(--color-tab-active-icon)] border border-transparent hover:border-[var(--color-tab-active-text)]',
		secondary:
			'bg-(--color-bg-hover) text-text-primary hover:text-[var(--color-tab-active-text)] hover:[&_svg]:text-[var(--color-tab-active-icon)] border border-transparent hover:border-[var(--color-tab-active-text)]',
		success: 'bg-(--color-success) hover:opacity-90 text-white border border-transparent',
		danger: 'bg-(--color-error) hover:opacity-90 text-white border border-transparent',
		ghost:
			'bg-transparent hover:bg-(--color-bg-tertiary) text-text-primary border border-transparent'
	};

	const sizeClasses = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-6 py-3 text-sm',
		lg: 'px-8 py-4 text-base'
	};

	const classes = $derived(
		`
		${variantClasses[variant]}
		${sizeClasses[size]}
		${fullWidth ? 'w-full' : ''}
		rounded-lg
		transition-colors transition-all
		flex items-center justify-center gap-2
		disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-(--color-bg-tertiary)
		font-semibold
	`
			.trim()
			.replace(/\s+/g, ' ')
	);
</script>

<button {type} {disabled} class={classes} {onclick} {...restProps}>
	{@render children()}
</button>
