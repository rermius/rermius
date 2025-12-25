<script>
	import { onMount, onDestroy } from 'svelte';
	import '../app.css';
	import { MainLayout } from '$lib/components/layout';
	import {
		loadKeychain,
		loadHosts,
		loadSyncSettings,
		loadSnippets,
		loadSettings
	} from '$lib/services';
	import { initAutoSync, stopAutoSync } from '$lib/services/auto-sync.js';
	import { initFileTransferProgressListener } from '$lib/services/file-transfer-events';
	import { themeStore, workspaceStore, tabsStore } from '$lib/stores';
	import {
		loadWorkspaces,
		isFirstLaunch,
		getCurrentWorkspaceId,
		setWorkspacesStore,
		addWorkspace
	} from '$lib/services/workspaces.js';
	import { checkMigrationNeeded, migrateExistingUser } from '$lib/services/workspace-migration.js';
	import { WorkspaceCreationModal } from '$lib/components/features/workspace';
	import { useToast } from '$lib/composables/useToast.svelte.js';
	import { keyboardShortcutManager } from '$lib/services/keyboard-shortcuts';
	import { get } from 'svelte/store';

	const toast = useToast();

	const { children } = $props();

	let showFirstLaunchModal = $state(false);
	let isInitializing = $state(true);

	/**
	 * Load workspace-specific data
	 */
	async function loadWorkspaceData(workspaceId) {
		await Promise.all([
			loadKeychain(workspaceId),
			loadHosts(workspaceId),
			loadSyncSettings(workspaceId),
			loadSnippets(workspaceId),
			loadSettings(workspaceId)
		]);
	}

	/**
	 * Handle first launch workspace creation
	 */
	async function handleFirstLaunchWorkspace(workspaceData) {
		try {
			// Create the workspace
			const newWorkspace = await addWorkspace(workspaceData);
			console.log('[Layout] First workspace created:', newWorkspace.name);

			// Load workspace data
			await loadWorkspaceData(newWorkspace.id);

			// Initialize services
			initAutoSync();
			await initFileTransferProgressListener();

			toast.success(`Welcome! Workspace "${newWorkspace.name}" created successfully`);
			isInitializing = false;
		} catch (error) {
			console.error('[Layout] Failed to create first workspace:', error);
			toast.error('Failed to create workspace. Please try again.');
			throw error;
		}
	}

	// Load all data when app starts
	onMount(async () => {
		try {
			// Initialize theme first
			themeStore.init();

			// Set workspace store instance (avoid circular dependency)
			setWorkspacesStore(workspaceStore);

			// Check if migration is needed (existing user)
			const migrationNeeded = await checkMigrationNeeded();
			if (migrationNeeded) {
				console.log('[Layout] Migration needed - migrating existing user data...');
				try {
					const result = await migrateExistingUser();
					console.log('[Layout] Migration complete:', result);
					toast.success('Welcome! Your data has been organized into a Default workspace', {
						duration: 5000
					});
				} catch (error) {
					console.error('[Layout] Migration failed:', error);
					toast.error('Failed to migrate data. Please contact support.');
					isInitializing = false;
					return;
				}
			}

			// Check for first launch
			const firstLaunch = await isFirstLaunch();
			if (firstLaunch) {
				console.log('[Layout] First launch detected - showing workspace creation modal');
				showFirstLaunchModal = true;
				isInitializing = false;
				return; // Wait for user to create workspace
			}

			// Load workspaces
			await loadWorkspaces();
			const currentWorkspaceId = getCurrentWorkspaceId();

			if (!currentWorkspaceId) {
				console.error('[Layout] No current workspace ID found');
				toast.error('No workspace found. Please create one.');
				showFirstLaunchModal = true;
				isInitializing = false;
				return;
			}

			console.log('[Layout] Loading workspace data for:', currentWorkspaceId);

			// Load workspace-specific data
			await loadWorkspaceData(currentWorkspaceId);

			// Initialize services
			initAutoSync();

			// Initialize file transfer progress listener
			try {
				await initFileTransferProgressListener();
			} catch (e) {
				console.error('[Layout] Error:', e);
			}

			// Initialize keyboard shortcuts
			cleanupKeyboardShortcuts = await initKeyboardShortcuts();

			isInitializing = false;
			console.log('[Layout] App initialization complete');
		} catch (error) {
			console.error('[Layout] Failed to load app data:', error);
			toast.error('Failed to load app data. Please refresh the app.');
			isInitializing = false;
		}
	});

	/**
	 * Initialize keyboard shortcuts and register global handlers
	 */
	async function initKeyboardShortcuts() {
		// Initialize shortcuts from settings
		await keyboardShortcutManager.init();

		// Register global shortcut handlers
		keyboardShortcutManager.register('newTerminal', () => {
			window.dispatchEvent(new CustomEvent('app:new-terminal'));
		});

		keyboardShortcutManager.register('closeTab', () => {
			const activeTabId = get(tabsStore).activeTabId;
			if (activeTabId && activeTabId !== 'home') {
				window.dispatchEvent(new CustomEvent('app:close-tab', { detail: { tabId: activeTabId } }));
			}
		});

		keyboardShortcutManager.register('nextTab', () => {
			// TODO: Implement tab cycling logic
		});

		keyboardShortcutManager.register('prevTab', () => {
			// TODO: Implement tab cycling logic
		});

		keyboardShortcutManager.register('openSettings', () => {
			window.dispatchEvent(new CustomEvent('app:open-settings'));
		});

		keyboardShortcutManager.register('toggleFileManager', () => {
			const activeTabId = get(tabsStore).activeTabId;
			window.dispatchEvent(
				new CustomEvent('app:toggle-file-manager', { detail: { tabId: activeTabId } })
			);
		});

		// Global keydown listener
		const handleGlobalKeyDown = (event) => {
			keyboardShortcutManager.handleKeyDown(event);
		};

		window.addEventListener('keydown', handleGlobalKeyDown);

		// Return cleanup function
		return () => {
			window.removeEventListener('keydown', handleGlobalKeyDown);
		};
	}

	let cleanupKeyboardShortcuts = null;

	onDestroy(() => {
		stopAutoSync();
		cleanupKeyboardShortcuts?.();
	});
</script>

{#if isInitializing}
	<!-- Loading screen -->
	<div class="fixed inset-0 bg-(--color-bg-primary) flex items-center justify-center z-50">
		<div class="flex flex-col items-center gap-4">
			<div
				class="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"
			></div>
			<p class="text-text-secondary text-sm">Loading rermius...</p>
		</div>
	</div>
{:else}
	<MainLayout>
		{@render children()}
	</MainLayout>
{/if}

<!-- First Launch Modal -->
<WorkspaceCreationModal
	bind:open={showFirstLaunchModal}
	editMode={false}
	requireAction={true}
	onConfirm={handleFirstLaunchWorkspace}
/>
