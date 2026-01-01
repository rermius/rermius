<script>
	import { ChevronDown, Terminal, Check } from 'lucide-svelte';

	let {
		options = [],
		value = $bindable(''),
		label = '',
		disabled = false,
		error = false,
		onchange = () => {}
	} = $props();

	let isOpen = $state(false);
	let dropdownElement;

	const selectedOption = $derived(options.find(opt => opt.value === value));

	function toggleDropdown() {
		if (disabled) return;
		isOpen = !isOpen;
	}

	function selectOption(option) {
		if (option.available === false) return; // Skip unavailable shells
		value = option.value;
		isOpen = false;
		onchange?.(option.value);
	}

	function handleClickOutside(event) {
		if (isOpen && dropdownElement && !dropdownElement.contains(event.target)) {
			isOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={dropdownElement}>
	{#if label}
		<span class="text-sm text-text-secondary mb-1 block">{label}</span>
	{/if}

	<!-- Select Button -->
	<button
		type="button"
		onclick={toggleDropdown}
		{disabled}
		aria-label={label || 'Shell selection'}
		class="w-full px-3 py-2 bg-(--color-bg-surface) text-white rounded-lg border border-border transition-colors text-left flex items-center justify-between {error
			? 'border-red-500 ring-1 ring-red-500'
			: isOpen
				? 'border-active ring-1 ring-active'
				: 'focus:border-active focus:ring-1 focus:ring-active'}"
	>
		<span class="flex items-center gap-2 flex-1 min-w-0">
			{#if selectedOption}
				<Terminal size={16} class="text-white/50 shrink-0" />
				<span class="truncate text-sm">{selectedOption.label}</span>
			{:else}
				<span class="text-white/50 text-sm">Select shell...</span>
			{/if}
		</span>
		<ChevronDown
			size={16}
			class="text-white/70 shrink-0 transition-transform {isOpen ? 'rotate-180' : ''}"
		/>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute w-full mt-2 bg-bg-secondary border border-border rounded-lg shadow-xl max-h-80 overflow-y-auto"
			style="z-index: var(--z-dropdown);"
		>
			{#each options as option (option.value)}
				<button
					type="button"
					onclick={() => selectOption(option)}
					disabled={option.available === false}
					class="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-border transition-colors text-left {value ===
					option.value
						? 'bg-border'
						: ''} {option.available === false ? 'opacity-50 cursor-not-allowed' : ''}"
				>
					<Terminal size={16} class="text-white/50 shrink-0" />
					<div class="flex flex-col gap-0.5 flex-1 min-w-0">
						<span class="text-sm text-white truncate">{option.label}</span>
						<span class="text-xs text-white/50 font-mono truncate">{option.value}</span>
					</div>
					{#if option.available === false}
						<span class="text-xs text-white/50 shrink-0">(Not available)</span>
					{/if}
					{#if value === option.value}
						<Check size={16} class="text-active shrink-0" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
