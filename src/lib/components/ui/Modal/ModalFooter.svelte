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

<div
	class="flex items-center gap-3 p-3 border-t border-border bg-bg-secondary {justifyClasses[
		justify
	]}"
>
	{@render children()}
</div>
