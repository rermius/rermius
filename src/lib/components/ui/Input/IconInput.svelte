<script>
	let {
		iconComponent = null, // Lucide icon component (required)
		type = 'text',
		value = $bindable(),
		placeholder = '',
		disabled = false,
		readonly = false,
		required = false,
		error = false,
		id = '',
		name = '',
		class: className = '',
		oninput,
		onchange,
		...restProps
	} = $props();
</script>

<div class="relative w-full">
	{#if iconComponent}
		{@const Icon = iconComponent}
		<div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
			<Icon size={16} class="text-text-tertiary" />
		</div>
	{/if}
	<input
		{type}
		{id}
		{name}
		{placeholder}
		{disabled}
		{readonly}
		{required}
		bind:value
		class="w-full {iconComponent
			? 'pl-10'
			: 'pl-3'} pr-3 py-2 bg-(--color-bg-surface) text-text-primary text-sm rounded-lg outline-none focus:ring-1 {error
			? 'ring-1 ring-[var(--color-error)]'
			: 'focus:ring-[var(--color-active)]'} disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-border focus:border-[var(--color-active)] ${className}"
		{oninput}
		{onchange}
		{...restProps}
	/>
</div>

<style>
	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
