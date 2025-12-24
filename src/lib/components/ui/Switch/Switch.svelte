<script>
	let { checked = $bindable(false), disabled = false, id = '', label = '', onchange } = $props();

	function handleClick() {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
	}

	function handleKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label || (checked ? 'On' : 'Off')}
	{id}
	{disabled}
	onclick={handleClick}
	onkeydown={handleKeydown}
	class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-active focus:ring-offset-2 focus:ring-offset-[#1E2235] disabled:cursor-not-allowed disabled:opacity-50 {checked
		? 'bg-active'
		: 'bg-border'}"
>
	<span
		class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {checked
			? 'translate-x-4'
			: 'translate-x-0'}"
	></span>
</button>
