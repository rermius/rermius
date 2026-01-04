<script>
	import { untrack } from 'svelte';
	import { debounce } from '$lib/utils';
	import { updateHost, getHostById } from '$lib/services';
	import { terminalStore } from '$lib/stores/terminal.store';
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

	const { sessionId = null, hostId = null } = $props();

	let fontFamily = $state('default');
	let fontSize = $state(defaultFontSize);
	let themeId = $state('default-dark');
	let isInitialLoad = $state(true);
	let fontSectionOpen = $state(false);

	// Load settings from host config (only once)
	$effect(() => {
		if (hostId) {
			const host = getHostById(hostId);
			fontFamily = host?.terminalAppearance?.fontFamily ?? 'default';
			fontSize = host?.terminalAppearance?.fontSize ?? defaultFontSize;
			themeId = host?.terminalAppearance?.themeId ?? 'default-dark';

			// Mark as loaded after initial values are set
			setTimeout(() => {
				isInitialLoad = false;
			}, 0);
		}
	});

	// Debounced auto-save (500ms)
	const saveSettings = debounce(async (settings) => {
		if (!hostId || isInitialLoad) return;

		try {
			await updateHost(hostId, {
				terminalAppearance: settings
			});

			// Apply to current terminal immediately
			if (sessionId) {
				untrack(() => {
					terminalStore.getSession(sessionId, (session) => {
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

						// Trigger resize to re-fit terminal after font changes
						setTimeout(() => {
							window.dispatchEvent(new Event('resize'));
						}, 50);
					});
				});
			}
		} catch (error) {
			console.error('Failed to save terminal settings:', error);
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

	// Auto-save when values change (skip initial load)
	$effect(() => {
		if (hostId && !isInitialLoad) {
			saveSettings({ fontFamily, fontSize, themeId });
		}
	});

	function handleThemeSelect(selectedThemeId) {
		themeId = selectedThemeId;
	}
</script>

<div class="terminal-settings-panel h-full flex flex-col p-4 gap-4">
	{#if !hostId}
		<div class="text-center py-8 text-white/60">
			<p>Terminal settings only available for remote hosts</p>
			<p class="text-sm mt-2">Local terminals use global theme</p>
		</div>
	{:else}
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
	{/if}
</div>
