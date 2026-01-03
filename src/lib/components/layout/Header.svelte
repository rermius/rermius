<script>
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { dndzone } from 'svelte-dnd-action';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { Tab } from '$lib/components/ui/Tab';
	import { tabsStore, terminalStore } from '$lib/stores';
	import { createLocalTerminal, hostsStore, terminalCommands, closeFileSession } from '$lib/services';
	import { Menu, Minus, Square, X, Plus, Files, Sun, Moon } from 'lucide-svelte';
	import { themeStore, updateStore } from '$lib/stores';
	import AppMenu from './AppMenu.svelte';
	import { SettingsModal } from '$lib/components/features/settings';

	import { onMount } from 'svelte';

	const appWindow = getCurrentWindow();
	const flipDurationMs = 200;

	// Menu state
	let menuOpen = $state(false);
	let showSettingsModal = $state(false);
	let menuButtonRef = $state(null);

	// Initialize event listeners for global shortcuts
	onMount(() => {
		const handleNewTerminal = () => openNewTerminal();
		const handleCloseTab = e => handleTabClose(e.detail);
		const handleOpenSettings = () => openSettingsModal();
		const handleToggleFileManager = e => {
			const tab = tabs.find(t => t.id === e.detail.tabId);
			if (tab) handleToggleFileManager(tab);
		};

		window.addEventListener('app:new-terminal', handleNewTerminal);
		window.addEventListener('app:close-tab', handleCloseTab);
		window.addEventListener('app:open-settings', handleOpenSettings);
		window.addEventListener('app:toggle-file-manager', handleToggleFileManager);

		return () => {
			window.removeEventListener('app:new-terminal', handleNewTerminal);
			window.removeEventListener('app:close-tab', handleCloseTab);
			window.removeEventListener('app:open-settings', handleOpenSettings);
			window.removeEventListener('app:toggle-file-manager', handleToggleFileManager);
		};
	});

	let tabs = $derived($tabsStore.tabs);
	const activeTabId = $derived($tabsStore.activeTabId);
	const homeTab = $derived(tabs.find(t => t.type === 'home'));
	const draggableTabs = $derived(tabs.filter(t => t.type !== 'home'));
	const hosts = $derived($hostsStore.hosts || []);
	const currentTheme = $derived($themeStore);

	function minimizeWindow() {
		appWindow.minimize();
	}

	function toggleMaximize() {
		appWindow.toggleMaximize();
	}

	function closeWindow() {
		appWindow.close();
	}

	async function openNewTerminal() {
		try {
			// Use centralized terminal manager
			await createLocalTerminal();
		} catch (error) {
			console.error('[Header] Failed to create terminal:', error);
		}
	}

	function handleTabClick(tabId) {
		tabsStore.setActiveTab(tabId);
	}

	async function handleTabClose(event) {
		const { tabId } = event;
		const tab = tabs.find(t => t.id === tabId);

		// Cancel auto-reconnect if in progress
		if (tab?.isReconnecting) {
			tabsStore.cancelTabReconnect(tabId);
		}

		// Close file session if exists
		if (tab?.fileSessionId) {
			try {
				await closeFileSession(tab.fileSessionId);
			} catch (error) {
				console.error('[Header] Error closing file session:', error);
			}
		}

		// Cleanup frontend terminal
		if (tab?.sessionId) {
			const storeValue = get(terminalStore);
			const terminalSession = storeValue?.sessions?.find(s => s.id === tab.sessionId);

			if (terminalSession?.cleanup && typeof terminalSession.cleanup === 'function') {
				try {
					await terminalSession.cleanup();
				} catch (error) {
					console.error('[Header] Error cleaning up frontend terminal:', error);
				}
			}
		}

		// Close backend terminal session
		if (tab?.sessionId) {
			try {
				await terminalCommands.closeTerminal(tab.sessionId);
			} catch (error) {
				console.error('[Header] Error closing terminal session:', error);
			}
		}

		// Remove tab
		tabsStore.removeTab(tabId);
	}

	function handleDndConsider(e) {
		const items = e.detail.items;
		tabs = homeTab ? [homeTab, ...items] : items;
	}

	function handleDndFinalize(e) {
		const items = e.detail.items;
		const newTabs = homeTab ? [homeTab, ...items] : items;
		tabs = newTabs;
		tabsStore.setTabs(newTabs);
	}

	function getHostById(hostId) {
		return hosts.find(h => h.id === hostId);
	}

	function handleToggleFileManager(tab) {
		// Only for terminal tabs with SSH host
		const host = tab?.hostId ? getHostById(tab.hostId) : null;
		if (!tab || tab.type !== 'terminal' || !host) return;

		// Toggle split view flag without affecting tab focus
		const next = !tab.showFileManager;
		tabsStore.updateTabConnectionState(tab.id, { showFileManager: next });
	}

	// Menu handlers
	function toggleMenu(event) {
		event.stopPropagation();
		menuOpen = !menuOpen;
	}

	function handleMenuClose() {
		menuOpen = false;
	}

	function navigateToHome() {
		// Set active tab to home
		tabsStore.setActiveTab('home');
		// Navigate to home route
		goto('/');
	}

	function openSettingsModal() {
		showSettingsModal = true;
		// TODO: Implement Settings modal
	}

	function exitApp() {
		closeWindow();
	}

	async function learnMore() {
		// Open external link to GitHub repo or docs
		try {
			const { openUrl } = await import('@tauri-apps/plugin-opener');
			await openUrl('https://github.com/rermius/rermius');
		} catch (error) {
			// Fallback to window.open if plugin not available
			window.open('https://github.com/rermius/rermius', '_blank');
		}
	}

	async function checkUpdate() {
		updateStore.checkForUpdates(false);
	}

	async function showInfo() {
		// TODO: Show app info modal with version, license, etc.
	}

	async function newWindow() {
		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('create_new_window');
		} catch (error) {
			console.error('Failed to create new window:', error);
		}
	}
</script>

<header
	class="bg-bg-primary flex items-center justify-between px-2 p-2 relative border-(--tab-bg)"
	style="z-index: var(--z-header);"
>
	<!-- Left Section -->
	<div class="flex items-center gap-2 px-3 h-full">
		<div class="mb-1">
			<button
				bind:this={menuButtonRef}
				type="button"
				onclick={toggleMenu}
				class="p-1 rounded transition-colors hover:bg-bg-hover"
				aria-label="Menu"
			>
				<Menu size={24} class="text-text-primary" />
			</button>
		</div>

		<!-- Home tab (not draggable) -->
		{#if homeTab}
			<div>
				<Tab
					tabId={homeTab.id}
					label={homeTab.label}
					active={homeTab.id === activeTabId}
					icon={homeTab.icon}
					closeable={homeTab.closeable}
					bgColor="var(--color-bg-tertiary)"
					onclick={() => handleTabClick(homeTab.id)}
				/>
			</div>
		{/if}

		<!-- Draggable terminal tabs -->
		{#if draggableTabs.length > 0}
			<div
				class="flex items-center gap-2 dnd-zone-no-border cursor-default"
				use:dndzone={{ items: draggableTabs, flipDurationMs }}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
			>
				{#each draggableTabs as tab (tab.id)}
					<div class="flex items-center gap-1">
						<Tab
							tabId={tab.id}
							label={tab.label}
							active={tab.id === activeTabId}
							icon={tab.icon}
							closeable={tab.closeable}
							bgColor="var(--color-tab-active-bg)"
							onclick={() => handleTabClick(tab.id)}
							onclose={handleTabClose}
							trailingIconComponent={tab.type === 'terminal' && tab.hostId ? Files : null}
							trailingTitle="Toggle remote file manager"
							onTrailingClick={() => handleToggleFileManager(tab)}
						/>
					</div>
				{/each}
			</div>
		{/if}

		<div>
			<Tab iconComponent={Plus} size={15} onclick={openNewTerminal} />
		</div>
	</div>

	<!-- Draggable Area (Middle) -->
	<div data-tauri-drag-region class="flex-1 h-full"></div>

	<!-- Right Section Theme Toggle - Hidden temporarily  -->
	<!-- <div class="flex items-center gap-4 px-6 w-[300px] justify-end">
		<button
			onclick={() => themeStore.toggle()}
			class="w-8 h-8 flex items-center justify-center hover:opacity-70 transition-opacity"
			aria-label="Toggle theme"
		>
			{#if currentTheme === 'dark'}
				<Sun size={16} class="text-text-secondary" />
			{:else}
				<Moon size={16} class="text-text-secondary" />
			{/if}
		</button>
	</div> -->

	<!-- macOS-style Window Controls -->
	<div class="absolute top-[10px] right-[5px] flex items-center gap-1.5 px-2">
		<!-- Close Button (Red) -->
		<button
			onclick={closeWindow}
			class="macos-window-control macos-close group"
			aria-label="Close"
			title="Close"
		>
			<div class="macos-dot macos-dot-close"></div>
			<X size={10} class="macos-icon" />
		</button>

		<!-- Minimize Button (Yellow) -->
		<button
			onclick={minimizeWindow}
			class="macos-window-control macos-minimize group"
			aria-label="Minimize"
			title="Minimize"
		>
			<div class="macos-dot macos-dot-minimize"></div>
			<Minus size={10} class="macos-icon" />
		</button>

		<!-- Maximize Button (Green) -->
		<button
			onclick={toggleMaximize}
			class="macos-window-control macos-maximize group"
			aria-label="Maximize"
			title="Maximize"
		>
			<div class="macos-dot macos-dot-maximize"></div>
			<Square size={10} class="macos-icon" />
		</button>
	</div>
</header>

<!-- AppMenu rendered outside header to escape stacking context -->
<AppMenu
	bind:open={menuOpen}
	buttonRef={menuButtonRef}
	onclose={handleMenuClose}
	onNavigateToHome={navigateToHome}
	onOpenSettingsModal={openSettingsModal}
	onCreateTerminal={openNewTerminal}
	onMinimize={minimizeWindow}
	onMaximize={toggleMaximize}
	onExit={exitApp}
	onLearnMore={learnMore}
	onCheckUpdate={checkUpdate}
	onShowInfo={showInfo}
	onNewWindow={newWindow}
/>

<!-- Settings Modal -->
<SettingsModal bind:open={showSettingsModal} />

<style>
	:global(.macos-window-control) {
		position: relative;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
		border: none;
		background: transparent;
	}

	:global(.macos-dot) {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		position: absolute;
		transition: opacity 0.2s ease;
	}

	:global(.macos-dot-close) {
		background-color: #ff5f57;
	}

	:global(.macos-dot-minimize) {
		background-color: #ffbd2e;
	}

	:global(.macos-dot-maximize) {
		background-color: #28ca42;
	}

	:global(.macos-icon) {
		opacity: 0;
		transition: opacity 0.2s ease;
		color: rgba(255, 255, 255, 1);
		position: relative;
		z-index: 1;
		font-weight: 600;
	}

	:global(.macos-window-control:hover .macos-dot) {
		opacity: 0.3;
	}

	:global(.macos-window-control:hover .macos-icon) {
		opacity: 1;
	}

	:global(.macos-window-control:active) {
		transform: scale(0.95);
	}
</style>
