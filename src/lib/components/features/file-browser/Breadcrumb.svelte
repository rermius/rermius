<script>
	import { ChevronLeft, ChevronRight, Folder } from 'lucide-svelte';

	let {
		path = '/',
		canGoBack = false,
		canGoForward = false,
		onBack,
		onForward,
		onNavigate
	} = $props();

	// Parse path into segments
	let segments = $derived(() => {
		const parts = path.split('/').filter(Boolean);
		const result = [];
		let currentPath = '';

		// Check if this is a Windows path (starts with drive letter like C:)
		const isWindowsPath = parts.length > 0 && /^[A-Za-z]:$/.test(parts[0]);

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (i === 0 && isWindowsPath) {
				// For Windows path, first segment should not have leading /
				currentPath = part;
			} else {
				// For Unix paths or subsequent segments, add /
				currentPath += '/' + part;
			}
			result.push({ name: part, path: currentPath });
		}

		return result;
	});

	function handleSegmentClick(segment) {
		onNavigate?.(segment.path);
	}
</script>

<div class="breadcrumb flex items-center gap-1 h-8 px-2 bg-dark-100 border-b bg-bg-secondary">
	<!-- Navigation buttons -->
	<button
		class="p-1 rounded hover:bg-dark-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
		disabled={!canGoBack}
		onclick={onBack}
		title="Go back"
	>
		<ChevronLeft size={16} class="text-white/70" />
	</button>

	<button
		class="p-1 rounded hover:bg-dark-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
		disabled={!canGoForward}
		onclick={onForward}
		title="Go forward"
	>
		<ChevronRight size={16} class="text-white/70" />
	</button>

	<!-- Path segments -->
	<div class="flex items-center gap-1 ml-2 overflow-x-auto flex-1">
		<!-- Root - only show for Unix paths or when no segments -->
		{#if segments().length === 0 || !/^[A-Za-z]:$/.test(segments()[0]?.name)}
			<button
				class="text-sm text-white/70 hover:text-white transition-colors"
				onclick={() => onNavigate?.('/')}
			>
				<Folder size={14} class="text-primary" />
			</button>
		{/if}

		{#each segments() as segment, i}
			<ChevronRight size={12} class="text-white/30 shrink-0" />
			<button
				class="text-sm text-white/70 hover:text-white transition-colors truncate max-w-32"
				onclick={() => handleSegmentClick(segment)}
			>
				{segment.name}
			</button>
		{/each}
	</div>
</div>
