<script>
	import { ScrollArea } from '$lib/components/ui';
	const { padding = true, children } = $props();
</script>

<ScrollArea class="flex-1 {padding ? 'p-6' : ''}">
	{@render children()}
</ScrollArea>
