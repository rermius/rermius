<script>
	import Input from './Input.svelte';

	let {
		value = $bindable(),
		placeholder = '',
		disabled = false,
		error = '',
		id = '',
		name = '',
		minlength = null,
		maxlength = null,
		pattern = '',
		autocomplete = '',
		oninput,
		onchange,
		onfocus,
		onblur,
		...restProps
	} = $props();
</script>

<Input
	type="text"
	bind:value
	{placeholder}
	{disabled}
	error={!!error}
	{id}
	{name}
	{autocomplete}
	{minlength}
	{maxlength}
	{pattern}
	{oninput}
	{onchange}
	{onfocus}
	{onblur}
	{...restProps}
/>
