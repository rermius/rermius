<script>
	let {
		id = '',
		value = $bindable(),
		placeholder = '',
		disabled = false,
		readonly = false,
		required = false,
		error = false,
		rows = 5,
		fullWidth = true,
		name = '',
		class: className = '',
		resize = true, // true | false (allow resize)
		oninput,
		onchange,
		onfocus,
		onblur,
		...restProps
	} = $props();

	const classes = $derived(
		`
		${fullWidth ? 'w-full' : ''}
		px-3 py-2
		bg-border
		text-white
		text-xs
		font-mono
		rounded-lg
		outline-none
		focus:ring-1
		${error ? 'ring-1 ring-red-500' : 'focus:ring-active'}
		disabled:opacity-50 disabled:cursor-not-allowed
		${resize ? 'resize-y' : 'resize-none'}
		transition-all
		border border-border bg-bg-secondary
		focus:border-active
		${className}
		`
			.trim()
			.replace(/\s+/g, ' ')
	);
</script>

<textarea
	{id}
	{name}
	{placeholder}
	{disabled}
	{readonly}
	{required}
	{rows}
	bind:value
	class={classes}
	{oninput}
	{onchange}
	{onfocus}
	{onblur}
	{...restProps}
></textarea>
