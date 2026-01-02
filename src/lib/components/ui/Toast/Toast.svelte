<script>
	import { fade, fly } from 'svelte/transition';

	const {
		message = '',
		type = 'info', // 'info' | 'success' | 'error' | 'warning'
		duration = 3000,
		dismissible = true,
		action = null, // NEW: { label: string, onClick: function }
		ondismiss
	} = $props();

	const typeClasses = {
		info: 'bg-blue-600 border-blue-500',
		success: 'bg-green-600 border-green-500',
		error: 'bg-red-600 border-red-500',
		warning: 'bg-yellow-600 border-yellow-500'
	};

	const typeIcons = {
		info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
		warning:
			'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
	};

	function handleDismiss() {
		ondismiss?.();
	}
</script>

<div
	class="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white border {typeClasses[
		type
	]} min-w-[300px] max-w-md"
	transition:fly={{ y: -20, duration: 200 }}
	role="alert"
	data-duration={duration}
>
	<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={typeIcons[type]} />
	</svg>

	<div class="flex-1 text-sm">
		{message}
	</div>

	{#if action}
		<button
			type="button"
			class="shrink-0 px-3 py-1 text-xs font-medium rounded bg-white/20 hover:bg-white/30 transition-colors"
			onclick={(e) => {
				e.stopPropagation();
				action.onClick();
			}}
		>
			{action.label}
		</button>
	{/if}

	{#if dismissible}
		<button
			type="button"
			class="shrink-0 text-white hover:text-gray-200 transition-colors"
			onclick={handleDismiss}
			aria-label="Dismiss"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	{/if}
</div>
