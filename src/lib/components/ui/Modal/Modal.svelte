<script>
	import { fade, scale } from 'svelte/transition';

	let {
		open = $bindable(false),
		size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
		closeOnBackdrop = true,
		closeOnEscape = true,
		children,
		onclose
	} = $props();

	const sizeClasses = {
		sm: 'max-w-md',
		md: 'max-w-lg',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl'
	};

	function handleBackdropClick() {
		if (closeOnBackdrop) {
			close();
		}
	}

	function handleEscape(event) {
		if (closeOnEscape && event.key === 'Escape' && open) {
			close();
		}
	}

	function close() {
		open = false;
		onclose?.();
	}
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
		style="z-index: var(--z-modal-backdrop);"
		transition:fade={{ duration: 200 }}
		onclick={handleBackdropClick}
		onkeydown={handleEscape}
		role="presentation"
	>
		<!-- Modal -->
		<div
			class="bg-(--color-bg-tertiary) rounded-lg shadow-xl w-full {sizeClasses[
				size
			]} max-h-[90vh] flex flex-col border border-border overflow-hidden bg-bg-secondary"
			style="z-index: var(--z-modal);"
			transition:scale={{ duration: 200, start: 0.95 }}
			onclick={e => e.stopPropagation()}
			onkeydown={e => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
		>
			{@render children({ close })}
		</div>
	</div>
{/if}
