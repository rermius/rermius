<script>
	let {
		type = 'text',
		value = $bindable(),
		inputElement = $bindable(),
		placeholder = '',
		disabled = false,
		readonly = false,
		required = false,
		error = false,
		fullWidth = true,
		id = '',
		name = '',
		autocomplete = '',
		class: className = '',
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
		bg-(--color-bg-surface)
		text-white
		text-sm
		rounded-lg
		outline-none
		focus:ring-1
		${error ? 'ring-1 ring-red-500' : 'focus:ring-active'}
		disabled:opacity-50 disabled:cursor-not-allowed
		transition-all
		border border-border
		focus:border-active
		${className}
	`
			.trim()
			.replace(/\s+/g, ' ')
	);
</script>

<input
	bind:this={inputElement}
	{type}
	{id}
	{name}
	{placeholder}
	{disabled}
	{readonly}
	{required}
	{autocomplete}
	bind:value
	class={classes}
	{oninput}
	{onchange}
	{onfocus}
	{onblur}
	{...restProps}
/>

<style>
	/* Hide number input spinners */
	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
