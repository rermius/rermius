<script>
	import { Search } from 'lucide-svelte';

	let { value = $bindable(''), placeholder = 'Search...', class: className = '' } = $props();
</script>

<div class="relative {className}">
	<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
	<input
		type="text"
		bind:value
		{placeholder}
		class="w-full pl-9 pr-3 py-2 bg-bg-secondary text-xs text-text-secondary placeholder-text-secondary rounded-lg outline-none border border-border focus:ring-1 focus:ring-[var(--color-active)] focus:border-[var(--color-active)] transition-all"
	/>
</div>
