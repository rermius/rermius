<script>
	import { onMount } from 'svelte';
	import { ScrollArea } from '$lib/components/ui/ScrollArea';
	import ShellSelect from '$lib/components/ui/ShellSelect/ShellSelect.svelte';
	import {
		loadSettings,
		getShellPreferences,
		updateShellPreferences,
		detectAvailableShells,
		getCurrentPlatform
	} from '$lib/services';
	import { workspaceStore } from '$lib/stores';
	import { toastStore } from '$lib/stores/toast.store';
	import { get } from 'svelte/store';
	import { Terminal, Info } from 'lucide-svelte';

	let platform = $state('');
	let availableShells = $state([]);
	let selectedShell = $state('');
	let isLoading = $state(true);

	const platformLabels = {
		windows: 'Windows',
		macos: 'macOS',
		linux: 'Linux'
	};

	onMount(async () => {
		await loadShellPreferences();
	});

	async function loadShellPreferences() {
		try {
			platform = getCurrentPlatform();
			const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
			const settings = await loadSettings(workspaceId);

			// Get available shells from settings with fallback for missing shellPreferences
			const platformPrefs = settings.shellPreferences?.[platform];
			if (!platformPrefs) {
				// Settings file doesn't have shellPreferences yet, use defaults
				const defaultPrefs = getShellPreferences(platform);
				availableShells = defaultPrefs.availableShells || [];
				selectedShell = defaultPrefs.defaultShell || '';
			} else {
				availableShells = platformPrefs.availableShells || [];
				selectedShell = platformPrefs.defaultShell || '';
			}

			// Detect which shells are actually available on system
			const detected = await detectAvailableShells();
			availableShells = availableShells.map(shell => {
				const detectedShell = detected.find(d => d.value === shell.value);
				return {
					...shell,
					available: detectedShell?.available ?? true
				};
			});
		} catch (error) {
			console.error('Failed to load shell preferences:', error);
			toastStore.error('Failed to load shell preferences');
		} finally {
			isLoading = false;
		}
	}

	async function handleShellChange(newShell) {
		try {
			const workspaceId = get(workspaceStore).activeWorkspaceId || 'default';
			await updateShellPreferences(workspaceId, platform, {
				defaultShell: newShell
			});
			selectedShell = newShell;
			toastStore.success('Default shell updated');
		} catch (error) {
			console.error('Failed to save shell preference:', error);
			toastStore.error('Failed to save shell preference');
		}
	}
</script>

<div class="flex flex-col h-full">
	<div class="p-6 border-b border-border">
		<h2 class="text-xl font-semibold text-text-primary">Shell Preferences</h2>
		<p class="text-sm text-text-secondary mt-1">
			Choose your default shell for new terminal sessions
		</p>
	</div>

	<ScrollArea class="flex-1 p-6">
		{#if isLoading}
			<div class="text-center text-text-secondary">Loading shell preferences...</div>
		{:else}
			<div class="space-y-6">
				<!-- Current Platform Info -->
				<div class="flex items-start gap-3 p-4 bg-bg-tertiary rounded border border-border">
					<Info size={20} class="text-accent-primary mt-0.5" />
					<div>
						<h3 class="text-sm font-medium text-text-primary">
							Current Platform: {platformLabels[platform]}
						</h3>
						<p class="text-xs text-text-secondary mt-1">
							These settings apply to terminal sessions on this operating system.
						</p>
					</div>
				</div>

				<!-- Shell Selection -->
				<div>
					<ShellSelect
						label="Default Shell"
						options={availableShells}
						bind:value={selectedShell}
						onchange={handleShellChange}
					/>

					<p class="text-xs text-text-tertiary mt-2">
						Selected: <span class="font-mono">{selectedShell}</span>
					</p>
				</div>

				<!-- Available Shells List -->
				<div>
					<h3 class="text-sm font-medium text-text-primary mb-2">Available Shells</h3>
					<div class="space-y-2">
						{#each availableShells as shell (shell.value)}
							<div class="flex items-center justify-between p-3 bg-bg-tertiary rounded">
								<div class="flex items-center gap-2">
									<Terminal size={16} class="text-text-secondary" />
									<span class="text-sm text-text-primary">{shell.label}</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-xs text-text-tertiary font-mono">{shell.value}</span>
									{#if shell.available === false}
										<span class="text-xs text-yellow-500">Not Found</span>
									{:else}
										<span class="text-xs text-green-500">Available</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</ScrollArea>
</div>
