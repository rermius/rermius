<script>
	const {
		variant = 'default', // 'default' | 'success' | 'error' | 'warning' | 'info'
		size = 'md', // 'sm' | 'md' | 'lg'
		rounded = true,
		children
	} = $props();

	const variantClasses = {
		default: 'bg-gray-700 text-gray-100',
		success: 'bg-green-600 text-white',
		error: 'bg-red-600 text-white',
		warning: 'bg-yellow-600 text-white',
		info: 'bg-blue-600 text-white'
	};

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm',
		lg: 'px-3 py-1.5 text-base'
	};

	const classes = $derived(
		`
		inline-flex items-center justify-center
		${variantClasses[variant]}
		${sizeClasses[size]}
		${rounded ? 'rounded-full' : 'rounded'}
		font-medium
	`
			.trim()
			.replace(/\s+/g, ' ')
	);
</script>

<span class={classes}>
	{@render children()}
</span>
