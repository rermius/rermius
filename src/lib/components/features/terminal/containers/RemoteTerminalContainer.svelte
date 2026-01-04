<!--
@component RemoteTerminalContainer
Container for remote SSH/SFTP terminal sessions with connection state management.
Orchestrates the terminal view, file manager split pane, and snippet sidebar.

@example
```svelte
<RemoteTerminalContainer
  tab={sshTab}
  activeTabId={currentTabId}
  host={hostConfig}
  onRetry={() => retryConnection()}
  onEdit={() => openEditPanel()}
  onClose={() => closeTab()}
/>
```

@prop {Object} tab - Tab object with connection state, sessionId, etc.
@prop {string} activeTabId - Currently active tab ID
@prop {Object|null} [host=null] - Host configuration
@prop {Function} onRetry - Callback for retry connection
@prop {Function} onEdit - Callback for edit host
@prop {Function} onClose - Callback for close tab
-->
<script>
	import { onMount } from 'svelte';
	import { RemoteTerminal, ConnectionEditWrapper } from '$lib/components/features/terminal';
	import { FilePanel } from '$lib/components/features/file-browser';
	import { createFileService, getUiSettings, updateUiSettings } from '$lib/services';
	import { SnippetSidebar } from '$lib/components/features/snippets';
	import { browser } from '$app/environment';

	const { tab, activeTabId, host = null, onRetry, onEdit, onClose } = $props();

	// For SSH terminal: only cd when user explicitly set homeDirectory
	const terminalHomeDir = $derived(
		host?.homeDirectory && host.homeDirectory.trim() ? host.homeDirectory : null
	);

	// Storage key for terminal split width (legacy localStorage support)
	const STORAGE_KEY = 'terminal-file-manager-split-width';

	// Load saved width from app settings (with localStorage fallback for backward compatibility)
	function loadSavedWidth() {
		// Prefer app settings value if available
		try {
			const ui = getUiSettings();
			if (ui && typeof ui.terminalFileSplitWidth === 'number') {
				const fromSettings = ui.terminalFileSplitWidth;
				if (!isNaN(fromSettings) && fromSettings >= 20 && fromSettings <= 80) {
					return fromSettings;
				}
			}
		} catch (e) {
			console.warn('Failed to load terminal width from app settings:', e);
		}

		// Fallback to browser localStorage
		if (!browser) return 50;

		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const width = parseFloat(saved);
				if (!isNaN(width) && width >= 20 && width <= 80) {
					return width;
				}
			}
		} catch (e) {
			console.warn('Failed to load saved terminal width from localStorage:', e);
		}

		return 50; // Default
	}

	// Resizable split pane state
	let terminalWidth = $state(loadSavedWidth());
	let isDragging = $state(false);
	let saveTimeout = null;

	// Snippet panel collapse state
	let snippetCollapsed = $state(false);

	// Debounced save function (persists to app settings and localStorage)
	function saveWidth(width) {
		// Clear existing timeout
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		// Set new timeout to save after 300ms of no changes
		saveTimeout = setTimeout(async () => {
			try {
				// Persist to app settings (synced per workspace)
				await updateUiSettings({ terminalFileSplitWidth: width });

				// Also sync legacy localStorage for backward compatibility
				if (browser) {
					try {
						localStorage.setItem(STORAGE_KEY, String(width));
					} catch (e) {
						console.warn('Failed to save terminal width to localStorage:', e);
					}
				}
			} catch (e) {
				console.warn('Failed to persist terminal width:', e);
			}

			saveTimeout = null;
		}, 300);
	}

	// Load saved width on mount and cleanup on unmount
	onMount(() => {
		terminalWidth = loadSavedWidth();

		// Cleanup function
		return () => {
			if (saveTimeout) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}
		};
	});

	function handleMouseDown(e) {
		isDragging = true;
		e.preventDefault();
	}

	function handleMouseMove(e) {
		if (!isDragging) return;

		const container = e.currentTarget.closest('.terminal-file-split-container');
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const terminalPercent = (x / rect.width) * 100;

		// Constrain between 20% and 80%
		const newWidth = Math.max(20, Math.min(80, terminalPercent));
		terminalWidth = newWidth;

		// Debounced save
		saveWidth(newWidth);
	}

	function handleMouseUp() {
		isDragging = false;
		// Save immediately when drag ends
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		// Persist final width without debounce
		saveWidth(terminalWidth);
	}
</script>

{#if tab.connectionState === 'CONNECTING' || tab.connectionState === 'FAILED' || tab.showProgressAnimation}
	<!-- Connection / error view with optional edit panel -->
	<ConnectionEditWrapper {tab} {host} {onRetry} {onEdit} {onClose} />
{:else if tab.connectionState === 'CONNECTED' && tab.sessionId}
	<!-- Connected: Terminal always mounted; optional split shows remote files -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="terminal-file-split-container h-full pb-2 flex bg-bg-primary overflow-hidden"
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
		role="application"
		aria-label="Terminal with snippet and file manager split view"
	>
		<!-- Terminal và Snippet gắn liền trong cùng một div -->
		<div
			class="flex min-w-0 overflow-hidden"
			style="width: {tab.showFileManager ? terminalWidth + '%' : '100%'}"
		>
			<!-- Terminal -->
			<div class="flex-1 relative bg-bg-primary min-w-0 overflow-hidden">
				<RemoteTerminal
					sessionId={tab.sessionId}
					active={tab.id === activeTabId}
					homeDirectory={terminalHomeDir}
					isLocal={tab.isLocal || false}
					hostId={host?.id}
				/>
			</div>
			<!-- Snippet Sidebar -->
			<SnippetSidebar
				sessionId={tab.sessionId}
				hostId={host?.id}
				collapsed={snippetCollapsed}
				ontoggle={() => (snippetCollapsed = !snippetCollapsed)}
			/>
		</div>
		{#if tab.showFileManager}
			<!-- Resizer -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
			<div
				class="resizer w-1 bg-border cursor-col-resize hover:bg-active transition-colors shrink-0"
				onmousedown={handleMouseDown}
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize terminal and file manager"
			></div>
			<!-- File Manager -->
			<div class="shrink-0 min-w-0" style="width: {100 - terminalWidth}%">
				{#if tab.fileSessionId}
					<FilePanel
						sessionId={tab.fileSessionId}
						type="sftp"
						title="Remote Files"
						initialPath="/"
						homePath={null}
						fileService={createFileService(tab.fileSessionId, false)}
					/>
				{:else}
					<div class="h-full flex items-center justify-center text-white/60 text-sm">
						Connecting file manager...
					</div>
				{/if}
			</div>
		{/if}
	</div>
{:else if tab.sessionId}
	<!-- Legacy terminal tab without connection state (backward compatible) -->
	{@const homeDir = host?.homeDirectory || null}
	<div class="h-full pb-2 flex overflow-hidden">
		<div class="flex-1 min-w-0 overflow-hidden">
			<RemoteTerminal
				sessionId={tab.sessionId}
				active={tab.id === activeTabId}
				homeDirectory={homeDir}
				isLocal={tab.isLocal || false}
				hostId={host?.id}
			/>
		</div>
		<!-- Snippet Sidebar -->
		<SnippetSidebar
			sessionId={tab.sessionId}
			hostId={host?.id}
			collapsed={snippetCollapsed}
			ontoggle={() => (snippetCollapsed = !snippetCollapsed)}
		/>
	</div>
{/if}

<style>
	.resizer:active {
		background-color: var(--color-active);
	}
</style>
