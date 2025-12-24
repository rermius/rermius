<script>
	import { Key, ChevronDown, Check, Plus, Search } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import { keychainStore } from '$lib/services';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui';

	let {
		value = $bindable(null), // Selected key ID
		placeholder = 'Select a key...',
		error = false,
		onchange
	} = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
	let dropdownElement;

	// Get all keys from keychain
	const allKeys = $derived($keychainStore.keys || []);

	// Filter keys based on search query
	const filteredKeys = $derived(
		allKeys.filter(key => {
			const search = searchQuery.toLowerCase();
			return (
				key.label.toLowerCase().includes(search) ||
				key.keyType.toLowerCase().includes(search) ||
				(key.fingerprint && key.fingerprint.toLowerCase().includes(search))
			);
		})
	);

	// Get selected key object
	const selectedKey = $derived(allKeys.find(k => k.id === value));

	function toggleDropdown() {
		isOpen = !isOpen;
		if (isOpen) {
			searchQuery = '';
		}
	}

	function selectKey(key) {
		value = key.id;
		isOpen = false;
		onchange?.(key);
	}

	function handleClickOutside(event) {
		if (isOpen && dropdownElement && !dropdownElement.contains(event.target)) {
			isOpen = false;
		}
	}

	function handleCreateKey() {
		// Navigate to keychain page
		goto('/keychain');
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={dropdownElement}>
	<!-- Select Button -->
	<button
		type="button"
		onclick={toggleDropdown}
		class="w-full px-3 py-2 bg-(--color-bg-surface) text-white rounded-lg border border-border transition-colors text-left flex items-center justify-between {error
			? 'border-red-500 ring-1 ring-red-500'
			: isOpen
				? 'border-active ring-1 ring-active'
				: 'focus:border-active focus:ring-1 focus:ring-active'}"
	>
		<span class="flex items-center gap-2 flex-1 min-w-0">
			{#if selectedKey}
				<Key size={16} class="text-white/50 shrink-0" />
				<span class="truncate text-sm">{selectedKey.label}</span>
				<span class="text-xs text-white/50 shrink-0">({selectedKey.keyType})</span>
			{:else}
				<span class="text-white/50 text-sm">{placeholder}</span>
			{/if}
		</span>
		<ChevronDown
			size={16}
			class="text-white/70 shrink-0 transition-transform {isOpen ? 'rotate-180' : ''}"
		/>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute overflow-hidden w-full mt-2 bg-bg-secondary border border-border rounded-lg shadow-xl max-h-80 flex flex-col"
			style="z-index: var(--z-dropdown);"
		>
			<!-- Search Input -->
			<div class="p-2 border-b border-border bg-bg-secondary">
				<div class="relative">
					<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search keys..."
						class="w-full pl-9 pr-3 py-2 bg-(--color-bg-surface) text-white text-sm rounded-lg border border-border focus:border-active focus:ring-1 focus:ring-active outline-none"
						onclick={e => e.stopPropagation()}
					/>
				</div>
			</div>

			<!-- Keys List with OverlayScrollbars -->
			<OverlayScrollbarsComponent
				options={{
					scrollbars: {
						autoHide: 'scroll'
					}
				}}
				class="max-h-60 keyselect-scrollbar"
			>
				<div class="overflow-y-auto">
					{#if filteredKeys.length === 0}
						<div class="p-4 text-center text-white/50 text-sm">
							{searchQuery ? 'No keys found' : 'No keys available'}
						</div>
					{:else}
						{#each filteredKeys as key (key.id)}
							<button
								type="button"
								onclick={() => selectKey(key)}
								class="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-border transition-colors text-left {value ===
								key.id
									? 'bg-border'
									: ''}"
							>
								<Key size={16} class="text-white/50 shrink-0" />
								<div class="flex flex-col gap-0.5 flex-1 min-w-0">
									<span class="text-sm text-white truncate">{key.label}</span>
									<div class="flex items-center gap-2 text-xs text-white/50">
										<span>{key.keyType}</span>
										{#if key.fingerprint}
											<span class="truncate">{key.fingerprint.substring(0, 20)}...</span>
										{/if}
									</div>
								</div>
								{#if value === key.id}
									<Check size={16} class="text-active shrink-0" />
								{/if}
							</button>
						{/each}
					{/if}
				</div>
			</OverlayScrollbarsComponent>

			<!-- Create Key Button -->
			<div class="p-2 border-t border-border bg-bg-secondary">
				<Button variant="primary" size="sm" fullWidth onclick={handleCreateKey}>
					<Plus size={16} />
					Create New Key
				</Button>
			</div>
		</div>
	{/if}
</div>

<style>
</style>
