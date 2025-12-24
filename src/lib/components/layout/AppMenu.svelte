<script>
	import {
		Home,
		Settings,
		Terminal,
		Eye,
		HelpCircle,
		AppWindow,
		LogOut,
		ChevronRight,
		Minimize,
		Maximize
	} from 'lucide-svelte';

	let {
		open = $bindable(false),
		onclose,
		onNavigateToHome,
		onOpenSettingsModal,
		onCreateTerminal,
		onMinimize,
		onMaximize,
		onExit,
		onLearnMore,
		onCheckUpdate,
		onShowInfo,
		onNewWindow
	} = $props();

	let dropdownElement = $state(null);
	let activeSubmenu = $state(null);

	// Menu items structure
	const menuItems = [
		{ type: 'item', label: 'Home', icon: Home, action: 'navigate', route: '/' },
		{ type: 'item', label: 'Settings', icon: Settings, action: 'openSettingsModal' },
		{ type: 'separator' },
		{ type: 'item', label: 'New Local Terminal', icon: Terminal, action: 'createTerminal' },
		{ type: 'separator' },
		{
			type: 'submenu',
			label: 'View',
			icon: Eye,
			items: [
				{ label: 'Minimize', action: 'minimize', icon: Minimize },
				{ label: 'Maximize', action: 'maximize', icon: Maximize }
			]
		},
		{
			type: 'submenu',
			label: 'Help',
			icon: HelpCircle,
			items: [
				{ label: 'Learn More', action: 'learnMore' },
				{ label: 'Check Update', action: 'checkUpdate' },
				{ label: 'Info', action: 'showInfo' }
			]
		},
		{
			type: 'submenu',
			label: 'Window',
			icon: AppWindow,
			items: [{ label: 'New Window', action: 'newWindow' }]
		},
		{ type: 'separator' },
		{ type: 'item', label: 'Exit', icon: LogOut, action: 'exit' }
	];

	function handleClickOutside(event) {
		// Don't close if clicking on the menu button or inside the dropdown
		if (
			open &&
			!event.target.closest('[aria-label="Menu"]') &&
			!(dropdownElement && dropdownElement.contains(event.target))
		) {
			open = false;
			activeSubmenu = null;
			onclose?.();
		}
	}

	function handleItemClick(item) {
		if (item.type === 'submenu') {
			// Toggle submenu
			activeSubmenu = activeSubmenu === item.label ? null : item.label;
			return;
		}

		// Handle action
		switch (item.action) {
			case 'navigate':
				if (item.route === '/') {
					onNavigateToHome?.();
				}
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'openSettingsModal':
				onOpenSettingsModal?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'createTerminal':
				onCreateTerminal?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'minimize':
				onMinimize?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'maximize':
				onMaximize?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'exit':
				onExit?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'learnMore':
				onLearnMore?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'checkUpdate':
				onCheckUpdate?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'showInfo':
				onShowInfo?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
			case 'newWindow':
				onNewWindow?.();
				open = false;
				activeSubmenu = null;
				onclose?.();
				break;
		}
	}

	function handleSubmenuItemClick(submenuItem, parentLabel) {
		handleItemClick(submenuItem);
	}
</script>

<svelte:window onclick={handleClickOutside} />

<!-- Dropdown Menu -->
{#if open}
	<div
		class="absolute left-0 top-full mt-2 w-56 bg-bg-secondary border border-border rounded-lg shadow-xl"
		bind:this={dropdownElement}
		style="z-index: var(--z-menu); overflow: visible;"
	>
			<div class="py-1" style="overflow: visible;">
				{#each menuItems as item, index (`${item.type}-${index}-${item.label || ''}`)}
					{#if item.type === 'separator'}
						<div class="h-px bg-border my-1"></div>
					{:else if item.type === 'submenu'}
						<div class="relative" style="z-index: var(--z-popover); overflow: visible;">
							<button
								type="button"
								onclick={() => handleItemClick(item)}
								onmouseenter={() => (activeSubmenu = item.label)}
								class="w-full px-3 py-2 flex items-center gap-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left"
							>
								{#if item.icon}
									{@const Icon = item.icon}
									<Icon size={16} class="text-text-secondary shrink-0" />
								{/if}
								<span class="flex-1">{item.label}</span>
								<ChevronRight
									size={14}
									class="text-text-tertiary shrink-0 transition-transform {activeSubmenu ===
									item.label
										? 'rotate-90'
										: ''}"
								/>
							</button>

							<!-- Submenu -->
							{#if activeSubmenu === item.label}
								<div
									class="absolute left-full top-0 ml-1 w-48 bg-bg-secondary border border-border rounded-lg shadow-xl py-1"
									style="position: absolute; min-width: 12rem; z-index: var(--z-popover);"
								>
									{#each item.items as subItem (subItem.label)}
										<button
											type="button"
											onclick={() => handleSubmenuItemClick(subItem, item.label)}
											class="w-full px-3 py-2 flex items-center gap-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left"
										>
											{#if subItem.icon}
												{@const SubIcon = subItem.icon}
												<SubIcon size={16} class="text-text-secondary shrink-0" />
											{/if}
											<span class="flex-1">{subItem.label}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<button
							type="button"
							onclick={() => handleItemClick(item)}
							class="w-full px-3 py-2 flex items-center gap-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left"
						>
							{#if item.icon}
								{@const Icon = item.icon}
								<Icon size={16} class="text-text-secondary shrink-0" />
							{/if}
							<span class="flex-1">{item.label}</span>
						</button>
					{/if}
				{/each}
			</div>
		</div>
{/if}

<style>
	/* Ensure submenu doesn't overflow viewport */
	:global(.relative) {
		position: relative;
	}
</style>
