<script>
	import { toastStore } from '$lib/stores/toast.store.js';
	import Toast from './Toast.svelte';

	const {
		position = 'top-right' // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
	} = $props();

	const positionClasses = {
		'top-right': 'top-4 right-4',
		'top-left': 'top-4 left-4',
		'bottom-right': 'bottom-4 right-4',
		'bottom-left': 'bottom-4 left-4',
		'top-center': 'top-4 left-1/2 -translate-x-1/2'
	};

	function handleDismiss(id) {
		toastStore.dismiss(id);
	}
</script>

<div
	class="fixed {positionClasses[position]} flex flex-col gap-2 pointer-events-none"
	style="z-index: var(--z-toast);"
>
	{#each $toastStore as toast (toast.id)}
		<div class="pointer-events-auto">
			<Toast
				message={toast.message}
				type={toast.type}
				duration={toast.duration}
				ondismiss={() => handleDismiss(toast.id)}
			/>
		</div>
	{/each}
</div>
