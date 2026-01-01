<!--
@component KeyScanFileItem
Displays a single file item in the scan modal with checkbox, preview, and warning
-->
<script>
	import { Checkbox } from '$lib/components/ui';
	import { Key, AlertCircle } from 'lucide-svelte';

	const { file, selected = false, previewType = null, hasWarning = false, onToggle } = $props();

	function formatFileSize(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	}

	function formatDate(timestamp) {
		if (!timestamp) return 'Unknown';
		const date = new Date(timestamp * 1000);
		return date.toLocaleDateString();
	}
</script>

<div
	class="group flex items-center gap-3 p-3 hover:bg-bg-hover hover:border-[var(--color-active)] border border-transparent transition-colors rounded-lg cursor-pointer"
	onclick={() => onToggle?.(file.path)}
	onkeydown={e => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onToggle?.(file.path);
		}
	}}
	role="button"
	tabindex="0"
>
	<Checkbox checked={selected} onchange={() => onToggle?.(file.path)} />

	<div class="flex-1 min-w-0">
		<div class="flex items-center gap-2">
			<Key
				size={14}
				class="text-text-tertiary shrink-0 transition-colors group-hover:text-[var(--color-active)]"
			/>
			<span
				class="text-sm text-text-primary font-medium truncate transition-colors group-hover:text-[var(--color-active)]"
			>
				{file.name}
			</span>
			{#if hasWarning}
				<AlertCircle size={14} class="text-orange-500 shrink-0 transition-colors" />
			{/if}
		</div>
		<div class="text-xs text-text-secondary mt-1 truncate">{file.path}</div>
		<div class="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
			{#if previewType}
				<span class="px-1.5 py-0.5 bg-bg-tertiary rounded">Type: {previewType}</span>
			{/if}
			<span>{formatFileSize(file.size)}</span>
			<span>{formatDate(file.modified)}</span>
		</div>
	</div>
</div>
