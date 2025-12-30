<script>
	import { onMount } from 'svelte';
	import { ScrollArea } from '$lib/components/ui/ScrollArea';
	import ShortcutInput from '$lib/components/ui/ShortcutInput/ShortcutInput.svelte';
	import * as appSettingsService from '$lib/services/app-settings';
	import { workspaceStore } from '$lib/stores';
	import { toastStore } from '$lib/stores/toast.store';
	import { get } from 'svelte/store';
	import { keyboardShortcutManager } from '$lib/services/keyboard-shortcuts';

	let shortcuts = $state({
		newTerminal: '',
		closeTab: '',
		nextTab: '',
		prevTab: '',
		openSettings: '',
		toggleFileManager: '',
		copyFile: '',
		cutFile: '',
		pasteFile: '',
		selectAllFiles: '',
		deleteFile: '',
		renameFile: '',
		refreshFileList: ''
	});

	let errors = $state({});
	let isLoading = $state(true);

	const shortcutLabels = {
		newTerminal: 'New Terminal',
		closeTab: 'Close Tab',
		nextTab: 'Next Tab',
		prevTab: 'Previous Tab',
		openSettings: 'Open Settings',
		toggleFileManager: 'Toggle File Manager',
		copyFile: 'Copy File',
		cutFile: 'Cut File',
		pasteFile: 'Paste File',
		selectAllFiles: 'Select All Files',
		deleteFile: 'Delete File',
		renameFile: 'Rename File',
		refreshFileList: 'Refresh File List'
	};

	const categories = {
		Application: [
			'newTerminal',
			'closeTab',
			'nextTab',
			'prevTab',
			'openSettings',
			'toggleFileManager'
		],
		'File Browser': [
			'copyFile',
			'cutFile',
			'pasteFile',
			'selectAllFiles',
			'deleteFile',
			'renameFile',
			'refreshFileList'
		]
	};

	onMount(async () => {
		await loadShortcuts();
	});

	async function loadShortcuts() {
		try {
			const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
			const settings = await appSettingsService.loadSettings(workspaceId);
			// Get shortcuts from settings or use service to get defaults
			shortcuts = appSettingsService.getShortcuts();
		} catch (error) {
			console.error('Failed to load shortcuts:', error);
			toastStore.error('Failed to load shortcuts');
		} finally {
			isLoading = false;
		}
	}

	function validateShortcut(actionName, value) {
		// Check for duplicates
		const duplicate = Object.entries(shortcuts).find(
			([key, val]) => key !== actionName && val === value && val !== ''
		);

		if (duplicate) {
			return `Shortcut already used by "${shortcutLabels[duplicate[0]]}"`;
		}

		return null;
	}

	async function handleShortcutChange(actionName, newValue) {
		const error = validateShortcut(actionName, newValue);
		errors[actionName] = error;

		if (!error) {
			try {
				const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
				await appSettingsService.updateShortcuts(workspaceId, { [actionName]: newValue });
				// Reload shortcuts in keyboard manager
				await keyboardShortcutManager.init();
				toastStore.success('Shortcut updated');
			} catch (error) {
				console.error('Failed to save shortcut:', error);
				toastStore.error('Failed to save shortcut');
			}
		}
	}

	async function resetToDefaults() {
		const confirmed = confirm('Reset all shortcuts to defaults?');
		if (!confirmed) return;

		try {
			const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';

			// Reset to default shortcuts from app-settings.js (updated to avoid conflicts)
			const defaultShortcuts = {
				newTerminal: 'Ctrl+T',
				closeTab: 'Ctrl+W',
				nextTab: 'Ctrl+Tab',
				prevTab: 'Ctrl+Shift+Tab',
				openSettings: 'Ctrl+,',
				toggleFileManager: 'Ctrl+B',
				copyFile: 'Ctrl+Shift+C',
				cutFile: 'Ctrl+Shift+X',
				pasteFile: 'Ctrl+Shift+V',
				selectAllFiles: 'Ctrl+Shift+A',
				deleteFile: 'Delete',
				renameFile: 'F2',
				refreshFileList: 'F5'
			};

			await appSettingsService.updateShortcuts(workspaceId, defaultShortcuts);
			// Reload shortcuts in keyboard manager
			await keyboardShortcutManager.init();
			shortcuts = defaultShortcuts;
			errors = {};
			toastStore.success('Shortcuts reset to defaults');
		} catch (error) {
			console.error('Failed to reset shortcuts:', error);
			toastStore.error('Failed to reset shortcuts');
		}
	}
</script>

<div class="flex flex-col h-full">
	<div class="p-6 border-b border-border">
		<h2 class="text-xl font-semibold text-text-primary">Keyboard Shortcuts</h2>
		<p class="text-sm text-text-secondary mt-1">Customize keyboard shortcuts for common actions</p>
	</div>

	<ScrollArea class="flex-1 p-6">
		{#if isLoading}
			<div class="text-center text-text-secondary">Loading shortcuts...</div>
		{:else}
			<div class="space-y-8">
				{#each Object.entries(categories) as [category, actions]}
					<div>
						<h3 class="text-sm font-semibold text-text-primary mb-4 uppercase tracking-wide">
							{category}
						</h3>
						<div class="space-y-1">
							{#each actions as actionName}
								<div
									class="grid grid-cols-2 gap-4 items-center py-3 px-4 rounded transition-colors hover:bg-bg-tertiary"
								>
									<div class="text-sm text-text-primary">{shortcutLabels[actionName]}</div>
									<div class="flex justify-end">
										<ShortcutInput
											bind:value={shortcuts[actionName]}
											onchange={(val) => handleShortcutChange(actionName, val)}
											error={errors[actionName]}
										/>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</ScrollArea>

	<div class="p-4 border-t border-border flex justify-end">
		<button
			type="button"
			onclick={resetToDefaults}
			class="px-4 py-2 bg-bg-tertiary text-text-primary rounded transition-colors
             hover:bg-bg-hover"
		>
			Reset to Defaults
		</button>
	</div>
</div>
