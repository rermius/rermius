<script>
	const {
		align = 'right', // 'left' | 'right' | 'center' | 'between'
		children
	} = $props();

	const alignClasses = {
		left: 'justify-start',
		right: 'justify-end',
		center: 'justify-center',
		between: 'justify-between'
	};
</script>

<div class="flex items-center gap-3 mt-6 pt-4 border-t border-gray-700 {alignClasses[align]}">
	{@render children()}
</div>
