<!--
@component ImportHostItem
Displays a single SSH config host item in the scan modal
-->
<script>
	import { Checkbox } from '$lib/components/ui';
	import { Server, Key, User, Globe } from 'lucide-svelte';

	let { host, selected = false, onToggle } = $props();

	function handleToggle() {
		onToggle?.(host.name);
	}
</script>

<div
	class="group flex items-start gap-3 p-3 bg-bg-secondary border border-border rounded-lg hover:border-[var(--color-active)] transition-colors"
	role="button"
	tabindex="0"
	onclick={handleToggle}
	onkeydown={e => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleToggle();
		}
	}}
>
	<Checkbox checked={selected} onchange={handleToggle} />

	<div class="flex-1 min-w-0">
		<div class="flex items-center gap-2 mb-1">
			<Server
				size={14}
				class="text-text-secondary flex-shrink-0 transition-colors group-hover:text-[var(--color-active)]"
			/>
			<span
				class="font-medium text-text-primary truncate transition-colors group-hover:text-[var(--color-active)]"
			>
				{host.name}
			</span>
		</div>

		<div
			class="flex flex-col gap-1 text-xs text-text-secondary group-hover:text-[var(--color-active)] transition-colors"
		>
			<div class="flex items-center gap-2">
				<Globe
					size={12}
					class="flex-shrink-0 transition-colors group-hover:text-[var(--color-active)]"
				/>
				<span class="truncate">{host.hostname}:{host.port}</span>
			</div>

			{#if host.user}
				<div class="flex items-center gap-2">
					<User
						size={12}
						class="flex-shrink-0 transition-colors group-hover:text-[var(--color-active)]"
					/>
					<span class="truncate">{host.user}</span>
				</div>
			{/if}

			{#if host.identityFile}
				<div class="flex items-center gap-2">
					<Key
						size={12}
						class="flex-shrink-0 transition-colors group-hover:text-[var(--color-active)]"
					/>
					<span class="truncate text-[10px]" title={host.identityFile}>
						{host.identityFile.split(/[\\/]/).pop()}
					</span>
				</div>
			{/if}
		</div>
	</div>
</div>
