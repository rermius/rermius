<script>
	import { untrack } from 'svelte';
	import { debounce } from '$lib/utils';
	import {
		updateHost,
		getHostById,
		getLocalTerminalSettings,
		updateLocalTerminalSettings,
		appSettingsStore
	} from '$lib/services';
	import { terminalStore } from '$lib/stores/terminal.store';
	import { tabsStore } from '$lib/stores';
	import { terminalThemes, getThemeById } from '$lib/constants/terminal-themes';
	import {
		terminalFonts,
		defaultFontFamily,
		defaultFontSize,
		minFontSize,
		maxFontSize
	} from '$lib/constants/terminal-fonts';
	import { Button } from '$lib/components/ui';
	import { ChevronDown, ChevronRight, Plus, Minus } from 'lucide-svelte';
	import ThemeList from './ThemeList.svelte';
	import { useActiveTabTheme } from '$lib/composables/useActiveTabTheme.svelte.js';

	const { sessionId = null, hostId = null } = $props();

	let fontFamily = $state('default');
	let fontSize = $state(defaultFontSize);
	let themeId = $state(null);
	let isInitialLoad = $state(true);
	let fontSectionOpen = $state(false);

	// Initialize tab theme watcher for force updates
	const tabThemeWatcher = useActiveTabTheme();

	// Track if we're currently saving or syncing to prevent feedback loops
	let isSaving = $state(false);
	let isSyncing = $state(false);
	let hasLoadedOnce = $state(false);

	// Track previous values to detect actual changes (initialized after load)
	let prevFontFamily = $state(null);
	let prevFontSize = $state(null);
	let prevThemeId = $state(null);

	// Load settings (once on mount)
	$effect(() => {
		// Only run once
		if (hasLoadedOnce) return;

		if (hostId) {
			// SSH terminal: load from host config
			const host = getHostById(hostId);
			fontFamily = host?.terminalAppearance?.fontFamily ?? 'default';
			fontSize = host?.terminalAppearance?.fontSize ?? defaultFontSize;
			themeId = host?.terminalAppearance?.themeId ?? 'default-dark';
		} else {
			// Local terminal: load from global settings (once)
			const settings = getLocalTerminalSettings();

			isSyncing = true; // Prevent auto-save during initial load
			fontFamily = settings.fontFamily;
			fontSize = settings.fontSize;
			themeId = settings.themeId;
			isSyncing = false;
		}

		// Initialize prev values AFTER loading to prevent initial auto-save
		prevFontFamily = fontFamily;
		prevFontSize = fontSize;
		prevThemeId = themeId;

		hasLoadedOnce = true;

		// Mark as loaded after initial values are set
		setTimeout(() => {
			isInitialLoad = false;
		}, 0);
	});

	// For local terminals: sync UI when store changes externally (not from our own saves)
	$effect(() => {
		if (!hostId && !isSaving && !isInitialLoad && hasLoadedOnce) {
			const settings = $appSettingsStore.localTerminal;

			if (settings) {
				// Check if actually different before syncing
				// Use untrack() to avoid making local state variables dependencies
				const isDifferent = untrack(
					() =>
						fontFamily !== settings.fontFamily ||
						fontSize !== settings.fontSize ||
						themeId !== settings.themeId
				);

				if (isDifferent) {
					isSyncing = true;
					fontFamily = settings.fontFamily;
					fontSize = settings.fontSize;
					themeId = settings.themeId;

					// Update prev values to prevent auto-save from triggering
					prevFontFamily = fontFamily;
					prevFontSize = fontSize;
					prevThemeId = themeId;

					isSyncing = false;
				}
			}
		}
	});

	// Debounced auto-save for SSH terminals (500ms)
	const saveSettings = debounce(async settings => {
		if (isInitialLoad) {
			return;
		}

		// Set flag to prevent sync effect from overwriting during save
		isSaving = true;

		try {
			if (hostId) {
				// SSH terminal: save to host config
				await updateHost(hostId, {
					terminalAppearance: settings
				});
			} else {
				// Local terminal: save to global settings
				await updateLocalTerminalSettings(settings);
			}

			// Apply to current terminal immediately
			if (sessionId) {
				untrack(() => {
					terminalStore.getSession(sessionId, session => {
						if (!session?.xterm) return;

						const terminal = session.xterm;
						const { fontFamily, fontSize, themeId } = settings;

						// Apply font family
						if (fontFamily && fontFamily !== 'default') {
							terminal.options.fontFamily = fontFamily;
						} else if (fontFamily === 'default') {
							terminal.options.fontFamily = defaultFontFamily;
						}

						// Apply font size
						if (fontSize && fontSize >= minFontSize) {
							terminal.options.fontSize = fontSize;
						}

						// Apply theme
						if (themeId) {
							const theme = getThemeById(themeId);
							if (theme) {
								terminal.options.theme = theme.colors;
							}
						}

						// Re-fit terminal after font/theme changes
						if (session.fitAddon) {
							setTimeout(() => {
								session.fitAddon.fit();
							}, 100);
						}
					});
				});
			}

			// Force theme update if this terminal is currently active
			if (sessionId) {
				const currentTab = $tabsStore.tabs.find(t => t.sessionId === sessionId);
				const isActive = currentTab && currentTab.id === $tabsStore.activeTabId;

				if (isActive) {
					// Small delay to ensure settings are updated
					setTimeout(() => {
						tabThemeWatcher.forceUpdate();
					}, 50);
				}
			} else if (!hostId) {
				// For local terminals without specific session, force update if any local terminal is active
				const activeTab = $tabsStore.tabs.find(t => t.id === $tabsStore.activeTabId);
				if (activeTab && activeTab.type === 'terminal' && !activeTab.hostId) {
					setTimeout(() => {
						tabThemeWatcher.forceUpdate();
					}, 50);
				}
			}
		} catch (error) {
			console.error('Failed to save terminal settings:', error);
		} finally {
			// Reset flag after save completes (success or error)
			setTimeout(() => {
				isSaving = false;
			}, 100);
		}
	}, 500);

	// Font size controls
	function incrementFontSize() {
		if (fontSize < maxFontSize) {
			fontSize = fontSize + 1;
		}
	}

	function decrementFontSize() {
		if (fontSize > minFontSize) {
			fontSize = fontSize - 1;
		}
	}

	// Auto-save when values change (skip initial load and syncing)
	$effect(() => {
		// Only save if values actually changed AND not during initial load/sync
		const hasChanged =
			fontFamily !== prevFontFamily || fontSize !== prevFontSize || themeId !== prevThemeId;

		// Save if values changed and not during initial load/sync
		// For local terminals: save regardless of active session (settings are global)
		// The isSyncing flag prevents feedback loops between multiple settings panels
		if (hasChanged && hasLoadedOnce && !isSyncing) {
			saveSettings({ fontFamily, fontSize, themeId });

			// Update tracked values
			prevFontFamily = fontFamily;
			prevFontSize = fontSize;
			prevThemeId = themeId;
		}
	});

	function handleThemeSelect(selectedThemeId) {
		themeId = selectedThemeId;
	}
</script>

<div class="terminal-settings-panel h-full flex flex-col p-4 gap-4">
	<!-- Show settings for both SSH and local terminals -->
	{#if !hostId}
		<div class="text-center py-2 px-4 bg-bg-secondary border border-border rounded">
			<p class="text-xs text-text-secondary">Global settings for all local terminals</p>
		</div>
	{/if}

	<!-- Font Settings (Collapsible) -->
	<div class="setting-group">
		<button
			type="button"
			onclick={() => (fontSectionOpen = !fontSectionOpen)}
			class="w-full flex items-center justify-between p-3 rounded transition-colors border
					{fontSectionOpen
				? 'bg-bg-tertiary border-active'
				: 'bg-bg-secondary border-border hover:bg-bg-hover hover:border-border'}"
		>
			<span class="text-sm font-medium text-text-primary">Font Settings</span>
			{#if fontSectionOpen}
				<ChevronDown size={16} class="text-text-secondary" />
			{:else}
				<ChevronRight size={16} class="text-text-secondary" />
			{/if}
		</button>

		{#if fontSectionOpen}
			<div class="mt-3 space-y-3 pl-2">
				<!-- Font Family -->
				<div>
					<label class="block text-xs font-medium text-text-tertiary mb-2">Font Family</label>
					<select
						bind:value={fontFamily}
						class="w-full px-3 py-2 bg-bg-secondary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-active hover:border-active transition-colors"
					>
						{#each terminalFonts as font (font.label)}
							<option value={font.value}>{font.label}</option>
						{/each}
					</select>
				</div>

				<!-- Font Size with +/- buttons -->
				<div>
					<label class="block text-xs font-medium text-text-tertiary mb-2">Font Size</label>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={decrementFontSize}
							disabled={fontSize <= minFontSize}
							class="px-2 py-1.5 h-8 border border-border rounded bg-bg-secondary hover:bg-bg-hover hover:border-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bg-secondary disabled:hover:border-border"
						>
							<Minus size={14} class="text-text-primary" />
						</button>
						<input
							type="number"
							min={minFontSize}
							max={maxFontSize}
							bind:value={fontSize}
							class="flex-1 text-center px-3 py-1.5 bg-bg-secondary border border-border rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-active hover:border-active transition-colors"
						/>
						<button
							type="button"
							onclick={incrementFontSize}
							disabled={fontSize >= maxFontSize}
							class="px-2 py-1.5 h-8 border border-border rounded bg-bg-secondary hover:bg-bg-hover hover:border-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bg-secondary disabled:hover:border-border"
						>
							<Plus size={14} class="text-text-primary" />
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Theme Selector -->
	<div class="setting-group flex-1 flex flex-col min-h-0">
		<label class="block text-sm font-medium text-text-primary mb-2">Terminal Theme</label>
		<ThemeList themes={terminalThemes} selectedId={themeId} onSelect={handleThemeSelect} />
	</div>
</div>
