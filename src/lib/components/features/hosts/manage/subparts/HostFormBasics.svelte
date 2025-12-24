<script>
	import { Input, TagInput, IconInput } from '$lib/components/ui';
	import { Server, ChevronDown, LayoutGrid, User, Tag } from 'lucide-svelte';
	import { useHostFormContext } from '../hostFormContext.svelte.js';
	import { untrack } from 'svelte';

	// Get form context - no props needed!
	const ctx = useHostFormContext();

	// Local state for tags (TagInput uses bind:tags)
	let tags = $state([]);

	// Track if we're syncing from context to prevent loop
	let syncingFromContext = false;

	// Sync tags FROM context (when context changes externally)
	$effect(() => {
		const contextTags = ctx.formData.tags;
		untrack(() => {
			// Compare arrays by content, not reference
			const tagsChanged = JSON.stringify(tags) !== JSON.stringify(contextTags || []);
			if (tagsChanged) {
				syncingFromContext = true;
				tags = contextTags || [];
				syncingFromContext = false;
			}
		});
	});

	// Handle tags change from TagInput (user interaction)
	$effect(() => {
		// Read tags to subscribe to changes
		const currentTags = tags;

		untrack(() => {
			const contextTags = ctx.formData.tags || [];
			const tagsChanged = JSON.stringify(currentTags) !== JSON.stringify(contextTags);

			// Only emit if not syncing from context AND value actually changed
			if (!syncingFromContext && tagsChanged) {
				ctx.handleTagsChange(currentTags);
			}
		});
	});

	// Reactive getters from context
	const formData = $derived(ctx.formData);
	const groups = $derived(ctx.getGroups());
</script>

<div class="flex flex-col gap-3">
	<div class="text-xs text-text-tertiary uppercase tracking-wider">General</div>

	<!-- Label -->
	<div class="flex flex-col gap-1">
		<IconInput
			iconComponent={Tag}
			id="label"
			value={formData.label}
			oninput={e => ctx.handleLabelChange(e.target.value)}
			placeholder="Label"
			error={!!ctx.errors.label}
			required
		/>
		{#if ctx.errors.label}
			<span class="text-xs text-[var(--color-error)] pl-10">{ctx.errors.label}</span>
		{/if}
	</div>

	<!-- Connection Type -->
	<div class="relative">
		<div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
			<Server size={16} class="text-text-tertiary" />
		</div>
		<select
			id="connectionType"
			value={formData.connectionType}
			onchange={e => ctx.handleConnectionTypeChange(e.target.value)}
			class="w-full pl-10 pr-8 py-2 bg-(--color-bg-surface) text-text-primary rounded-lg border border-border focus:border-[var(--color-active)] focus:ring-1 focus:ring-[var(--color-active)] outline-none text-sm appearance-none"
		>
			{#each ctx.connectionTypes as type (type.value)}
				<option value={type.value}>{type.label}</option>
			{/each}
		</select>
		<ChevronDown
			size={16}
			class="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
		/>
	</div>

	<!-- Username -->
	<IconInput
		iconComponent={User}
		id="username"
		value={formData.username}
		oninput={e => ctx.handleUsernameChange(e.target.value)}
		placeholder="Username"
	/>

	<!-- Group Selection -->
	<div class="relative">
		<div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
			<LayoutGrid size={16} class="text-text-tertiary" />
		</div>
		<select
			id="group"
			value={formData.groupId}
			class="w-full pl-10 pr-8 py-2 bg-(--color-bg-surface) text-text-primary rounded-lg border border-border focus:border-[var(--color-active)] focus:ring-1 focus:ring-[var(--color-active)] outline-none text-sm appearance-none"
			onchange={e => ctx.handleGroupChange(e.target.value)}
		>
			<option value="" class="text-text-tertiary">Group</option>
			{#each groups as group (group.id)}
				<option value={group.id}>{group.name}</option>
			{/each}
		</select>
		<ChevronDown
			size={16}
			class="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
		/>
	</div>

	<!-- Tags -->
	<TagInput bind:tags allTags={ctx.localAllTags} />

	<!-- Hostname & Port -->
	<div class="flex flex-col gap-1">
		<div class="flex gap-2">
			<div class="flex-1">
				<IconInput
					iconComponent={Server}
					id="hostname"
					value={formData.hostname}
					oninput={e => ctx.handleHostnameChange(e.target.value)}
					placeholder="IP or Hostname"
					error={!!ctx.errors.hostname}
					required
				/>
			</div>
			<div class="w-20">
				<Input
					id="port"
					type="number"
					value={formData.port}
					placeholder="22"
					oninput={e => ctx.handlePortChange(parseInt(e.target.value, 10) || 0)}
				/>
			</div>
		</div>
		{#if ctx.errors.hostname}
			<span class="text-xs text-[var(--color-error)] pl-10">{ctx.errors.hostname}</span>
		{/if}
	</div>
</div>
