<script>
	import { onMount } from 'svelte';
	import { Terminal, Search } from 'lucide-svelte';
	import { hostsStore } from '$lib/services';
	import { getConnectionIcon } from '$lib/utils/ui/icons';
	import { SearchInput } from '$lib/components/ui/SearchInput';
	import { ScrollArea } from '$lib/components/ui/ScrollArea';

	const {
		open = false,
		position = { x: 0, y: 0 },
		onClose,
		onSelectLocalTerminal,
		onSelectHost
	} = $props();

	let hostSearchQuery = $state('');
	let menuElement = $state(null);
	let portalContainer = $state(null);

	// Get hosts from store
	const hosts = $derived($hostsStore.hosts || []);

	// Filter hosts based on search query
	const filteredHosts = $derived.by(() => {
		if (!hostSearchQuery || !hostSearchQuery.trim()) {
			return hosts.sort((a, b) => {
				// Sort by label or hostname
				const labelA = (a.label || a.hostname || '').toLowerCase();
				const labelB = (b.label || b.hostname || '').toLowerCase();
				return labelA.localeCompare(labelB);
			});
		}

		const query = hostSearchQuery.toLowerCase().trim();
		return hosts
			.filter(host => {
				const labelMatch = (host.label || '').toLowerCase().includes(query);
				const hostnameMatch = (host.hostname || '').toLowerCase().includes(query);
				const usernameMatch = (host.username || '').toLowerCase().includes(query);
				return labelMatch || hostnameMatch || usernameMatch;
			})
			.sort((a, b) => {
				const labelA = (a.label || a.hostname || '').toLowerCase();
				const labelB = (b.label || b.hostname || '').toLowerCase();
				return labelA.localeCompare(labelB);
			});
	});

	// Portal pattern - mount dropdown to document.body
	onMount(() => {
		portalContainer = document.createElement('div');
		portalContainer.className = 'new-tab-dropdown-portal';
		document.body.appendChild(portalContainer);

		return () => {
			if (portalContainer && document.body.contains(portalContainer)) {
				document.body.removeChild(portalContainer);
			}
		};
	});

	// Mount/unmount dropdown in portal
	$effect(() => {
		if (!portalContainer || !open || !menuElement) return;

		const container = menuElement.closest('.new-tab-dropdown-container');
		if (container && container.parentElement !== portalContainer) {
			const originalParent = container.parentElement;
			portalContainer.appendChild(container);

			return () => {
				if (container && portalContainer.contains(container) && originalParent) {
					originalParent.appendChild(container);
				}
			};
		}
	});


	// Click outside detection
	$effect(() => {
		if (open) {
			const handleClickOutside = event => {
				if (menuElement && !menuElement.contains(event.target)) {
					onClose?.();
				}
			};

			// Use capture phase to handle before other handlers
			window.addEventListener('click', handleClickOutside, true);
			window.addEventListener('mousedown', handleClickOutside, true);

			return () => {
				window.removeEventListener('click', handleClickOutside, true);
				window.removeEventListener('mousedown', handleClickOutside, true);
			};
		}
	});

	// Auto-focus search input when dropdown opens
	$effect(() => {
		if (open && menuElement) {
			// Small delay to ensure input is rendered, then focus the input inside SearchInput
			setTimeout(() => {
				const input = menuElement.querySelector('input[type="text"]');
				input?.focus();
			}, 50);
		}
	});

	// Reset search query when dropdown closes
	$effect(() => {
		if (!open) {
			hostSearchQuery = '';
		}
	});

	// Keyboard navigation
	function handleKeydown(event) {
		if (!open) return;

		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				onClose?.();
				break;
			case 'ArrowDown':
				event.preventDefault();
				focusNextItem();
				break;
			case 'ArrowUp':
				event.preventDefault();
				focusPreviousItem();
				break;
			case 'Enter': {
				event.preventDefault();
				const focusedItem = menuElement?.querySelector('[role="menuitem"]:focus');
				if (focusedItem) {
					focusedItem.click();
				}
				break;
			}
		}
	}

	function focusNextItem() {
		if (!menuElement) return;
		const items = menuElement.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])');
		const currentIndex = Array.from(items).indexOf(document.activeElement);
		const nextIndex = currentIndex + 1 < items.length ? currentIndex + 1 : 0;
		items[nextIndex]?.focus();
	}

	function focusPreviousItem() {
		if (!menuElement) return;
		const items = menuElement.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])');
		const currentIndex = Array.from(items).indexOf(document.activeElement);
		const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : items.length - 1;
		items[prevIndex]?.focus();
	}

	function handleSelectLocalTerminal() {
		onSelectLocalTerminal?.();
		onClose?.();
	}

	function handleSelectHost(host) {
		onSelectHost?.(host);
		onClose?.();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="new-tab-dropdown-container" bind:this={menuElement}>
		<div
			role="menu"
			class="fixed bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden transition-opacity w-[320px]"
			style:left="{position.x}px"
			style:top="{position.y}px"
			style:max-width="calc(100vw - {position.x}px - 8px)"
			style:max-height="calc(100vh - {position.y}px - 8px)"
			style:z-index="var(--z-dropdown)"
		>
			<!-- Local Terminal Button -->
			<button
				type="button"
				role="menuitem"
				onclick={handleSelectLocalTerminal}
				class="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-hover transition-colors text-left border-b border-border"
			>
				<div
					class="flex items-center justify-center w-8 h-8 rounded-lg bg-(--color-primary)/20 shrink-0"
				>
					<Terminal size={18} class="text-[#4A9FFF]" />
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-sm font-semibold text-text-primary">Local Terminal</div>
					<div class="text-xs text-text-secondary">Create a new local terminal</div>
				</div>
			</button>

			<!-- Search Box -->
			<div class="px-3 py-2 border-b border-border">
				<SearchInput
					bind:value={hostSearchQuery}
					placeholder="Search hosts..."
					class="w-full"
				/>
			</div>

			<!-- Hosts List -->
			<div class="h-[300px] overflow-hidden">
				<ScrollArea class="h-full">
					<div class="flex flex-col py-1">
						{#if filteredHosts.length === 0}
							<div class="px-4 py-8 text-center">
								<p class="text-xs text-text-secondary">
									{#if hostSearchQuery}
										No hosts found matching "{hostSearchQuery}"
									{:else}
										No hosts available
									{/if}
								</p>
							</div>
						{:else}
							{#each filteredHosts as host (host.id)}
								{@const HostIcon = getConnectionIcon(host.connectionType || 'ssh')}
								<button
									type="button"
									role="menuitem"
									onclick={() => handleSelectHost(host)}
									class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-bg-hover transition-colors text-left"
								>
									<div
										class="flex items-center justify-center w-8 h-8 rounded-lg bg-(--color-primary)/20 shrink-0"
									>
										<HostIcon size={18} class="text-[#4A9FFF]" />
									</div>
									<div class="flex-1 min-w-0">
										<div class="text-sm font-semibold text-text-primary truncate">
											{host.label || host.hostname || 'Unnamed Host'}
										</div>
										{#if host.hostname}
											<div class="text-xs text-text-secondary truncate">
												{host.username || 'root'}@{host.hostname}
											</div>
										{/if}
									</div>
								</button>
							{/each}
						{/if}
					</div>
				</ScrollArea>
			</div>
		</div>
	</div>
{/if}

