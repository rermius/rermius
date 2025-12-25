<script>
	import { fade, slide } from 'svelte/transition';
	import { updateStore } from '$lib/stores';
	import { Rocket, ExternalLink, X } from 'lucide-svelte';
	import { PUBLIC_UPDATE_REPO_URL } from '$env/static/public';

	let status = $derived($updateStore.status);
	let manifest = $derived($updateStore.manifest);
	let progress = $derived($updateStore.progress);

	function handleUpdate() {
		if (status === 'available') {
			updateStore.downloadAndInstall();
		} else if (status === 'ready') {
			updateStore.applyAndRestart();
		}
	}

	function handleDismiss() {
		updateStore.dismiss();
	}

	function openChangelog() {
		if (PUBLIC_UPDATE_REPO_URL) {
			window.open(PUBLIC_UPDATE_REPO_URL, '_blank');
		}
	}
</script>

{#if status !== 'idle'}
	<div
		transition:slide={{ axis: 'y', duration: 300 }}
		class="fixed top-4 right-4 w-[340px] bg-(--color-bg-secondary) border border-(--color-border) rounded-lg shadow-2xl p-3 text-text-primary overflow-hidden"
		style="z-index: var(--z-notification);"
	>
		<!-- Header -->
		<div class="flex items-center justify-between mb-2">
			<div class="flex items-center gap-2">
				<Rocket size={16} class="text-(--color-active) fill-(--color-active)" />
                <h3 class="font-bold text-[13px] tracking-wide text-text-primary">New Rermius version</h3>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-xs text-text-tertiary font-medium">{manifest?.date || 'Today'}</span>
				<!-- Keeping close button for UX even if not in mockup -->
				<button 
					onclick={handleDismiss}
					class="text-text-tertiary hover:text-text-primary transition-colors ml-1"
					aria-label="Dismiss"
				>
					<X size={12} />
				</button>
			</div>
		</div>

		<!-- Body -->
		<div class="mb-3">
			<p class="text-[13px] text-text-secondary">
				Version <span class="font-bold text-text-primary">{manifest?.version || '0.0.0'}</span> {status === 'ready' ? 'is ready to install.' : 'is ready to install.'}
			</p>
			{#if status === 'downloading'}
				<div class="mt-2 w-full bg-(--color-bg-tertiary) rounded-full h-1 overflow-hidden">
					<div 
						class="bg-(--color-active) h-full rounded-full transition-all duration-300" 
						style="width: {progress}%"
					></div>
				</div>
				<p class="text-[10px] text-text-tertiary mt-1 font-medium">Downloading... {Math.round(progress)}%</p>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-2">
			<button
				onclick={openChangelog}
				class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-(--color-bg-tertiary) hover:bg-(--color-bg-hover) rounded-md transition-colors"
			>
				Changelog
				<ExternalLink size={12} />
			</button>

			<button
				onclick={handleUpdate}
				disabled={status === 'downloading' || status === 'checking'}
				class="flex-1 px-3 py-1.5 text-xs font-bold bg-(--color-bg-tertiary) text-text-primary hover:bg-(--color-bg-hover) hover:text-(--color-active) disabled:bg-(--color-bg-tertiary) disabled:text-text-disabled rounded-md transition-all shadow-sm active:scale-95"
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
