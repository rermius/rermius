<script>
	import Input from './Input.svelte';
	import { Eye, EyeOff } from 'lucide-svelte';

	let {
		value = $bindable(),
		placeholder = '',
		disabled = false,
		readonly = false,
		required = false,
		error = false,
		fullWidth = true,
		id = '',
		name = '',
		autocomplete = '',
		oninput,
		onchange,
		onfocus,
		onblur,
		...restProps
	} = $props();

	let showPassword = $state(false);
	let isHolding = $state(false);

	function handleMouseDown(e) {
		e.preventDefault();
		isHolding = true;
		showPassword = true;
	}

	function handleMouseUp() {
		isHolding = false;
		showPassword = false;
	}

	function handleMouseLeave() {
		if (isHolding) {
			isHolding = false;
			showPassword = false;
		}
	}

	// Handle touch events for mobile
	function handleTouchStart(e) {
		e.preventDefault();
		isHolding = true;
		showPassword = true;
	}

	function handleTouchEnd() {
		isHolding = false;
		showPassword = false;
	}
</script>

<div class="relative w-full">
	<Input
		{id}
		{name}
		{placeholder}
		{disabled}
		{readonly}
		{required}
		{error}
		fullWidth={true}
		{autocomplete}
		type={showPassword ? 'text' : 'password'}
		bind:value
		class="pr-10"
		{oninput}
		{onchange}
		{onfocus}
		{onblur}
		{...restProps}
	/>
	<button
		type="button"
		class="absolute right-2 top-1/2 -translate-y-1/2 p-1"
		onmousedown={handleMouseDown}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseLeave}
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
		disabled={disabled || readonly}
		aria-label={showPassword ? 'Hide password' : 'Show password'}
		tabindex="-1"
	>
		{#if showPassword}
			<Eye size={16} class="text-white/50" />
		{:else}
			<EyeOff size={16} class="text-white/50" />
		{/if}
	</button>
</div>
