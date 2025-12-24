<script>
	import { KeySelect, IconInput } from '$lib/components/ui';
	import { Lock, Info, Key as KeyIcon, Server } from 'lucide-svelte';
	import { useHostFormContext } from '../hostFormContext.svelte.js';
	import { untrack } from 'svelte';

	// Get form context - no props needed!
	const ctx = useHostFormContext();

	// Local state for keyId (KeySelect uses bind:value)
	let keyId = $state(null);

	// Track if we're syncing from context to prevent loop
	let syncingFromContext = false;

	// Sync keyId FROM context (when context changes externally, e.g. edit mode)
	$effect(() => {
		const contextKeyId = ctx.formData.keyId;
		untrack(() => {
			if (keyId !== contextKeyId) {
				syncingFromContext = true;
				keyId = contextKeyId ?? null;
				syncingFromContext = false;
			}
		});
	});

	// Handle keyId change from KeySelect (user interaction)
	$effect(() => {
		// Read keyId to subscribe to changes
		const currentKeyId = keyId;

		untrack(() => {
			// Only emit if not syncing from context AND value actually changed
			if (!syncingFromContext && currentKeyId !== ctx.formData.keyId) {
				ctx.handleKeyChange(currentKeyId);
			}
		});
	});

	// Auth method options
	const authMethods = [
		{ value: 'key', label: 'SSH Key', icon: KeyIcon },
		{ value: 'password', label: 'Password', icon: Lock },
		{ value: 'agent', label: 'SSH Agent', icon: Server }
	];

	// Reactive getter
	const formData = $derived(ctx.formData);
</script>

<div class="flex flex-col gap-3">
	<div class="text-xs text-text-tertiary uppercase tracking-wider mt-2">Credentials</div>

	<!-- Auth Method Selection (only for SSH/SFTP) -->
	{#if ctx.supportsSshKey(formData.connectionType)}
		<fieldset class="flex flex-col gap-2">
			<div class="flex gap-2">
				{#each authMethods as method (method.value)}
					{@const AuthIcon = method.icon}
					<button
						type="button"
						onclick={() => ctx.handleAuthMethodChange(method.value)}
						class="flex-1 px-3 py-2 rounded-lg border-2 transition-colors {formData.authMethod ===
						method.value
							? 'bg-(--color-bg-surface) border-[var(--color-active)]'
							: 'bg-(--color-bg-tertiary) border-border hover:border-[var(--color-bg-hover)]'}"
						aria-pressed={formData.authMethod === method.value}
					>
						<div class="flex flex-col items-center gap-1">
							{#if AuthIcon}
								<AuthIcon
									size={20}
									class={formData.authMethod === method.value
										? 'text-[var(--color-active)]'
										: 'text-text-tertiary'}
								/>
							{/if}
							<span class="text-xs text-text-secondary">{method.label}</span>
						</div>
					</button>
				{/each}
			</div>
		</fieldset>
	{:else}
		<!-- Password-only auth for FTP/FTPS/Telnet -->
		<IconInput
			iconComponent={Lock}
			id="password"
			type="password"
			value={formData.password}
			oninput={e => ctx.handlePasswordChange(e.target.value)}
			placeholder="Password"
		/>
	{/if}

	<!-- Auth Method Specific Fields (only for SSH/SFTP) -->
	{#if ctx.supportsSshKey(formData.connectionType)}
		{#if formData.authMethod === 'key'}
			<KeySelect bind:value={keyId} placeholder="Select a key..." />
		{:else if formData.authMethod === 'password'}
			<IconInput
				iconComponent={Lock}
				id="password"
				type="password"
				value={formData.password}
				oninput={e => ctx.handlePasswordChange(e.target.value)}
				placeholder="Password"
			/>
		{:else if formData.authMethod === 'agent'}
			<div class="flex items-center gap-2 bg-(--color-bg-surface) px-3 py-2 rounded-lg">
				<Info size={16} class="text-[var(--color-primary)]" />
				<span class="text-xs text-text-secondary">Will use SSH Agent for authentication</span>
			</div>
		{/if}
	{/if}
</div>
