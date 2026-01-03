<script>
	import { fade, slide } from 'svelte/transition';
	import { updateStore } from '$lib/stores';
	import { Rocket, ExternalLink, X } from 'lucide-svelte';
	import { formatRelativeTime } from '$lib/utils';

	let status = $derived($updateStore.status);
	let manifest = $derived($updateStore.manifest);
	let progress = $derived($updateStore.progress);

	function handleUpdate() {
		if (status === 'available') {
			updateStore.downloadAndInstall(false);
		} else if (status === 'ready') {
			updateStore.applyAndRestart();
		}
	}

	function handleDismiss() {
		updateStore.dismiss();
	}

	async function openChangelog() {
		try {
			const { openUrl } = await import('@tauri-apps/plugin-opener');
			await openUrl('https://github.com/rermius/rermius/releases');
		} catch (error) {
			console.error('Failed to open changelog:', error);
			// Fallback to window.open
			window.open('https://github.com/rermius/rermius/releases', '_blank');
		}
	}
</script>

{#if status !== 'idle'}
	<div
		transition:slide={{ axis: 'y', duration: 300 }}
		class="fixed top-4 right-4 z-[9999] w-[340px] overflow-hidden rounded-lg border border-(--color-border) bg-(--color-bg-secondary) p-3 text-text-primary shadow-2xl"
	>
		<!-- Header -->
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Rocket size={16} class="fill-(--color-active) text-(--color-active)" />
				<h3 class="text-[13px] font-bold tracking-wide text-text-primary">New Rermius version</h3>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-text-tertiary"
					>{formatRelativeTime(manifest?.date)}</span
				>
				<!-- Keeping close button for UX even if not in mockup -->
				<button
					onclick={handleDismiss}
					class="ml-1 text-text-tertiary transition-colors hover:text-text-primary"
					aria-label="Dismiss"
				>
					<X size={12} />
				</button>
			</div>
		</div>

		<!-- Body -->
		<div class="mb-3">
			<p class="text-[13px] text-text-secondary">
				Version <span class="font-bold text-text-primary">{manifest?.version || '0.0.0'}</span>
				{status === 'ready' ? 'is ready to install.' : 'is available for download.'}
			</p>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-2">
			<button
				onclick={openChangelog}
				class="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-(--color-bg-tertiary) px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-(--color-bg-hover)"
			>
				Changelog
				<ExternalLink size={12} />
			</button>

			<button
				onclick={handleUpdate}
				disabled={status === 'downloading' || status === 'checking'}
				class="flex-1 active:scale-95 rounded-md bg-(--color-bg-tertiary) px-3 py-1.5 text-xs font-bold text-text-primary shadow-sm transition-all hover:bg-(--color-bg-hover) hover:text-(--color-active) disabled:bg-(--color-bg-tertiary) disabled:text-text-disabled"
			>
				{#if status === 'available'}
					Download now
				{:else if status === 'downloading'}
					Downloading...
				{:else if status === 'ready'}
					Restart and update
				{:else}
					Update
				{/if}
			</button>
		</div>
	</div>
{/if}

<style>
	/* Custom shadow for premium feel matching the dark theme */
	.shadow-2xl {
		box-shadow: 0 20px 60px -15px rgba(0, 0, 0, 0.7);
	}
</style>
