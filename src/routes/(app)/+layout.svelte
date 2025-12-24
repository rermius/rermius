<script>
	import { onMount, onDestroy } from 'svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import { ToastContainer } from '$lib/components/ui';
	import { initSyncChecker } from '$lib/composables';

	const { children } = $props();

	let cleanupSyncChecker;

	onMount(() => {
		// Initialize sync checker for periodic update checks
		cleanupSyncChecker = initSyncChecker();
	});

	onDestroy(() => {
		// Cleanup sync checker when layout is destroyed
		cleanupSyncChecker?.();
	});
</script>

<div class="flex h-full">
	<Sidebar />
	<div class="flex-1 overflow-auto">
		{@render children()}
	</div>
</div>

<!-- Toast notifications -->
<ToastContainer position="top-right" />
