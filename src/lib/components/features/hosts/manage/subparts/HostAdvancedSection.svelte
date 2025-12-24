<script>
	import { IconInput } from '$lib/components/ui';
	import { ChevronDown, ChevronRight, Link, StickyNote, Folder } from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import { useHostFormContext } from '../hostFormContext.svelte.js';

	// Get form context - no props needed!
	const ctx = useHostFormContext();

	// Reactive getters
	const formData = $derived(ctx.formData);
	const hostChainSummary = $derived(ctx.getHostChainSummary());
</script>

<div class="flex flex-col gap-2">
	<button
		type="button"
		class="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors mt-2"
		onclick={ctx.toggleAdvanced}
	>
		<span class="uppercase tracking-wider">Advanced</span>
		{#if ctx.showAdvanced}
			<ChevronDown size={12} />
		{:else}
			<ChevronRight size={12} />
		{/if}
	</button>

	{#if ctx.showAdvanced}
		<div class="flex flex-col gap-3 pl-1" transition:slide={{ duration: 200 }}>
			<!-- Host Chaining (only for SSH/SFTP) -->
			{#if ctx.supportsHostChaining(formData.connectionType)}
				<button
					type="button"
					class="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-(--color-bg-surface) hover:bg-(--color-bg-hover) hover:border-[var(--color-active)] transition-colors"
					onclick={ctx.openChaining}
				>
					<Link size={16} class="text-text-tertiary" />
					<span
						class="text-sm {ctx.hostChainIds.length === 0
							? 'text-text-tertiary'
							: 'text-text-primary'}"
					>
						{hostChainSummary}
					</span>
				</button>
			{/if}

			<!-- Notes -->
			<IconInput
				iconComponent={StickyNote}
				id="notes"
				value={formData.notes}
				oninput={e => ctx.handleNotesChange(e.target.value)}
				placeholder="Notes"
			/>

			<!-- Home Directory (for SSH/SFTP) -->
			{#if ctx.supportsHostChaining(formData.connectionType)}
				<IconInput
					iconComponent={Folder}
					id="homeDirectory"
					value={formData.homeDirectory}
					oninput={e => ctx.handleHomeDirChange(e.target.value)}
					placeholder={formData.username === 'root'
						? '/root'
						: `/home/${formData.username || 'user'}`}
				/>
				<p class="text-xs text-text-tertiary">
					Start directory when connecting (leave empty for default: {formData.username === 'root'
						? '/root'
						: `/home/${formData.username || 'user'}`})
				</p>
			{/if}
		</div>
	{/if}
</div>
