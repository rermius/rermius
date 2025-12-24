<script>
	const {
		justify = 'end', // 'start' | 'center' | 'end' | 'between'
		children
	} = $props();

	const justifyClasses = {
		start: 'justify-start',
		center: 'justify-center',
		end: 'justify-end',
		between: 'justify-between'
	};
</script>

<div class="flex items-center gap-3 mt-4 {justifyClasses[justify]}">
	{@render children()}
</div>
