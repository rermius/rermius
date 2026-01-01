<script>
	import { X } from 'lucide-svelte';

	let {
		value = $bindable(''),
		label = '',
		disabled = false,
		onchange = () => {},
		error = null
	} = $props();

	let isCapturing = $state(false);
	let containerElement = $state(null);

	const keyParts = $derived(value ? value.split('+').map(k => k.trim()) : []);

	function startCapture() {
		if (disabled) return;
		isCapturing = true;
	}

	function handleKeyDown(event) {
		if (!isCapturing) return;

		// Check Escape first - always cancel, never save
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			isCapturing = false;
			containerElement?.blur();
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const parts = [];
		if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
		if (event.altKey) parts.push('Alt');
		if (event.shiftKey) parts.push('Shift');

		const key = event.key;
		if (key === 'Tab') parts.push('Tab');
		else if (key === 'Delete') parts.push('Delete');
		else if (key.startsWith('F') && key.length <= 3) parts.push(key);
		else if (key.length === 1) parts.push(key.toUpperCase());

		if (parts.length > 1) {
			// Must have modifier + key
			value = parts.join('+');
			isCapturing = false;
			containerElement?.blur();
			onchange(value);
		}
	}

	function handleClick(event) {
		event.stopPropagation();
		startCapture();
	}

	function handleClickOutside(event) {
		if (isCapturing && containerElement && !containerElement.contains(event.target)) {
			isCapturing = false;
			containerElement.blur();
		}
	}

	function clearShortcut() {
		value = '';
		onchange('');
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="flex flex-col gap-1">
	{#if label}
		<span class="text-sm text-text-secondary">{label}</span>
	{/if}

	<div class="flex items-center gap-2">
		<button
			type="button"
			bind:this={containerElement}
			onclick={handleClick}
			onkeydown={handleKeyDown}
			{disabled}
			class="flex-1 min-w-0 px-3 py-2 bg-bg-tertiary rounded border border-border
			       text-left transition-colors hover:border-border-hover
			       focus:outline-none focus:ring-2 focus:ring-accent-primary
			       disabled:opacity-50 disabled:cursor-not-allowed"
			class:ring-2={isCapturing}
			class:ring-accent-primary={isCapturing}
			aria-label={label || 'Keyboard shortcut input'}
		>
			{#if isCapturing}
				<span class="text-sm text-text-secondary">Press key combination...</span>
			{:else if value}
				<div class="flex items-center gap-1.5 flex-wrap">
					{#each keyParts as keyPart, index (keyPart + '-' + index)}
						<span
							class="inline-flex items-center justify-center px-2 py-1 text-xs font-semibold
							       bg-bg-primary border border-border rounded min-w-[32px] text-text-primary"
						>
							{keyPart}
						</span>
						{#if index < keyParts.length - 1}
							<span class="text-text-tertiary text-xs">+</span>
						{/if}
					{/each}
				</div>
			{:else}
				<span class="text-sm text-text-secondary">Click to set shortcut</span>
			{/if}
		</button>

		{#if value && !disabled}
			<button
				type="button"
				onclick={clearShortcut}
				class="p-2 rounded transition-colors hover:bg-bg-hover"
				aria-label="Clear shortcut"
			>
				<X size={16} class="text-text-secondary" />
			</button>
		{/if}
	</div>

	{#if error}
		<span class="text-xs text-red-500">{error}</span>
	{/if}
</div>
