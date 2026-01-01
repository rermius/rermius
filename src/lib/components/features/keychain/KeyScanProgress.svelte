<!--
@component KeyScanProgress
Displays progress bar and counters during import operation
-->
<script>
	const { current = 0, total = 0, success = 0, errors = 0, duplicates = 0 } = $props();

	const progress = $derived(total > 0 ? Math.round((current / total) * 100) : 0);
</script>

{#if total > 0}
	<div class="flex flex-col gap-2">
		<!-- Progress Bar -->
		<div class="w-full bg-border rounded-full h-2 overflow-hidden">
			<div class="h-full bg-primary transition-all duration-300" style="width: {progress}%"></div>
		</div>

		<!-- Counters -->
		<div class="flex items-center justify-between text-xs text-text-secondary">
			<span>Progress: {current} / {total}</span>
			<div class="flex items-center gap-3">
				{#if success > 0}
					<span class="text-green-500">✓ {success} imported</span>
				{/if}
				{#if duplicates > 0}
					<span class="text-orange-500">⚠ {duplicates} duplicates</span>
				{/if}
				{#if errors > 0}
					<span class="text-red-500">✗ {errors} errors</span>
				{/if}
			</div>
		</div>
	</div>
{/if}
