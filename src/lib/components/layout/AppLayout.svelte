<script>
	import Sidebar from './Sidebar.svelte';
	import { ToastContainer, ScrollArea } from '$lib/components/ui';

	const { children, class: className = '' } = $props();
</script>

<div class="flex h-full {className}">
	<Sidebar />
	<ScrollArea class="flex-1">
		{@render children()}
	</ScrollArea>

	<!-- Toast notifications -->
	<ToastContainer position="top-right" />
</div>
