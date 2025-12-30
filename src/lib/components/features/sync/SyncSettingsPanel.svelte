<script>
	import { onMount, untrack } from 'svelte';
	import {
		Input,
		Button,
		PasswordInput,
		Switch,
		Modal,
		ModalHeader,
		ModalBody,
		ModalFooter,
		ScrollArea
	} from '$lib/components/ui';
	import { FieldError } from '$lib/components/forms';
	import { syncSettingsStore } from '$lib/stores/sync-settings.store.js';
	import {
		saveSyncSettings,
		validateGitHubCredentials,
		getGistHistory,
		downloadGistVersion
	} from '$lib/services/sync-settings.js';
	import { useToast } from '$lib/composables';
	import {
		hostsStore,
		snippetsStore,
		saveHosts,
		keychainStore,
		saveSnippets,
		saveKeychain
	} from '$lib/services';
	import { workspaceStore, syncLogsStore, hasNewSyncVersion, syncVersionStore } from '$lib/stores';
	import { get } from 'svelte/store';
	import { performUpload, performDownload } from '$lib/services/sync-checker';

	const toast = useToast();

	// Track if validation is in progress
	let isValidating = $state(false);

	// Track if download is in progress
	let isDownloading = $state(false);

	// Track if we're waiting for download confirmation
	let pendingDownloadData = $state(null);

	// History state
	let showHistory = $state(false);
	let historyLoading = $state(false);
	let historyList = $state([]);
	let selectedVersion = $state(null);
	let historyPage = $state(1);
	let historyHasMore = $state(false);
	const HISTORY_PER_PAGE = 10;

	// Rollback options modal
	let showRollbackOptions = $state(false);
	let rollbackSha = $state(null);

	// Track previous credential values to detect changes (not reactive - just plain object)
	let prevGithubCredentials = {
		token: '',
		gist: '',
		encryptPassword: ''
	};

	// Track validated credentials snapshot (to restore validation if user reverts changes)
	let validatedGithubCredentials = {
		token: '',
		gist: '',
		encryptPassword: ''
	};

	// Track if credentials have been initialized (to skip validation reset on first load)
	let credentialsInitialized = false;

	// Track previous workspace ID to detect workspace changes
	let prevWorkspaceId = $workspaceStore.currentWorkspaceId;

	// Initialize prevGithubCredentials on mount and watch for changes
	$effect(() => {
		const currentWorkspaceId = $workspaceStore.currentWorkspaceId;

		// Check if workspace changed
		if (currentWorkspaceId !== prevWorkspaceId) {
			prevWorkspaceId = currentWorkspaceId;
			// Reset initialization flag so that loading new workspace settings won't reset validation
			credentialsInitialized = false;
			// Reset prev credentials to empty so next load is treated as initial load
			prevGithubCredentials = {
				token: '',
				gist: '',
				encryptPassword: ''
			};
			// If new workspace has validated credentials, save them as validated snapshot
			if ($syncSettingsStore.github.isValidated) {
				validatedGithubCredentials = {
					token: $syncSettingsStore.github.token,
					gist: $syncSettingsStore.github.gist,
					encryptPassword: $syncSettingsStore.github.encryptPassword
				};
			} else {
				validatedGithubCredentials = {
					token: '',
					gist: '',
					encryptPassword: ''
				};
			}
			return; // Skip credential change check on workspace change
		}

		// Read only the credential fields we care about (these create dependencies)
		const token = $syncSettingsStore.github.token;
		const gist = $syncSettingsStore.github.gist;
		const encryptPassword = $syncSettingsStore.github.encryptPassword;

		// Check if credentials changed (compare with non-reactive prev)
		const hasChanged =
			token !== prevGithubCredentials.token ||
			gist !== prevGithubCredentials.gist ||
			encryptPassword !== prevGithubCredentials.encryptPassword;

		if (hasChanged) {
			// Check if prev has any value (not all empty) - means this is a real change after initialization
			const isRealChange =
				credentialsInitialized ||
				prevGithubCredentials.token !== '' ||
				prevGithubCredentials.gist !== '' ||
				prevGithubCredentials.encryptPassword !== '';

			// Check if current credentials match the validated snapshot
			const matchesValidated =
				token === validatedGithubCredentials.token &&
				gist === validatedGithubCredentials.gist &&
				encryptPassword === validatedGithubCredentials.encryptPassword;

			// On first load, if credentials are validated, save them as validated snapshot
			if (!credentialsInitialized && $syncSettingsStore.github.isValidated) {
				validatedGithubCredentials = { token, gist, encryptPassword };
			}

			// Update prev values
			prevGithubCredentials = { token, gist, encryptPassword };

			// Mark as initialized after first update
			if (!credentialsInitialized) {
				credentialsInitialized = true;
			}

			// Update validation status if this is a real user change (not initial load from file)
			if (isRealChange) {
				untrack(() => {
					const currentStore = get(syncSettingsStore);

					if (matchesValidated && validatedGithubCredentials.token !== '') {
						// Restore validation if credentials match validated snapshot
						if (!currentStore.github.isValidated) {
							console.warn(
								'[SyncSettings] Credentials reverted to validated state, restoring validation'
							);
							syncSettingsStore.setValidated('github', true);
						}
					} else {
						// Reset validation if credentials differ from validated snapshot
						if (currentStore.github.isValidated) {
							console.warn('[SyncSettings] Credentials changed, resetting validation');
							syncSettingsStore.setValidated('github', false);
						}
					}
				});
			}
		}
	});

	// Validation errors
	let errors = $state({
		github: { token: '', gist: '', encryptPassword: '' },
		gitee: { token: '', gist: '', encryptPassword: '' },
		custom: { url: '', token: '', encryptPassword: '' },
		cloud: { encryptPassword: '' }
	});

	// Sync logs scroll container ref
	let logsContainer = $state(null);

	// Sync logs tab state
	let activeLogTab = $state('upload'); // 'upload' | 'download'

	// Helper functions to use sync logs store
	function addLog(message, type = 'info', logType = null) {
		syncLogsStore.addLog(message, type, logType);
	}

	function clearLogs() {
		syncLogsStore.clear();
	}

	// Filter logs based on active tab
	const filteredLogs = $derived($syncLogsStore.filter(log => log.logType === activeLogTab));

	// Auto-scroll to bottom when logs change
	$effect(() => {
		// Access the store to create dependency
		const _logs = $syncLogsStore;
		// Scroll to bottom after DOM update
		if (logsContainer) {
			setTimeout(() => {
				// Find the OverlayScrollbars viewport and scroll to bottom
				const osHost = logsContainer.closest('.os-host');
				const viewport = osHost?.querySelector('.os-viewport');
				if (viewport) {
					viewport.scrollTop = viewport.scrollHeight;
				}
			}, 0);
		}
	});

	// Validate form based on active tab
	function validateForm() {
		// Reset errors
		errors = {
			github: { token: '', gist: '', encryptPassword: '' },
			gitee: { token: '', gist: '', encryptPassword: '' },
			custom: { url: '', token: '', encryptPassword: '' },
			cloud: { encryptPassword: '' }
		};

		let isValid = true;
		const activeTab = $syncSettingsStore.activeTab;

		if (activeTab === 'github') {
			if (!$syncSettingsStore.github.token.trim()) {
				errors.github.token = 'Token is required';
				isValid = false;
			}
			if (!$syncSettingsStore.github.encryptPassword.trim()) {
				errors.github.encryptPassword = 'Encrypt Password is required';
				isValid = false;
			}
		} else if (activeTab === 'gitee') {
			if (!$syncSettingsStore.gitee.token.trim()) {
				errors.gitee.token = 'Token is required';
				isValid = false;
			}
			if (!$syncSettingsStore.gitee.encryptPassword.trim()) {
				errors.gitee.encryptPassword = 'Encrypt Password is required';
				isValid = false;
			}
		} else if (activeTab === 'custom') {
			if (!$syncSettingsStore.custom.url.trim()) {
				errors.custom.url = 'URL is required';
				isValid = false;
			}
			if (!$syncSettingsStore.custom.token.trim()) {
				errors.custom.token = 'Token is required';
				isValid = false;
			}
			if (!$syncSettingsStore.custom.encryptPassword.trim()) {
				errors.custom.encryptPassword = 'Encrypt Password is required';
				isValid = false;
			}
		} else if (activeTab === 'cloud') {
			if (!$syncSettingsStore.cloud.encryptPassword.trim()) {
				errors.cloud.encryptPassword = 'Encrypt Password is required';
				isValid = false;
			}
		}

		return isValid;
	}

	// Use store directly for two-way binding
	// No need for local state - bind directly to store

	// Tabs
	const tabs = [
		{ id: 'github', label: 'GitHub' },
		{ id: 'gitee', label: 'Gitee' },
		{ id: 'custom', label: 'Custom' },
		{ id: 'cloud', label: 'Cloud' }
	];

	// Sync options
	const syncOptions = [
		{ key: 'settings', label: 'Settings' },
		{ key: 'bookmarks', label: 'Bookmarks' },
		{ key: 'terminalThemes', label: 'Terminal themes' },
		{ key: 'quickCommands', label: 'Quick commands' },
		{ key: 'profiles', label: 'Profiles' },
		{ key: 'addressBookmarks', label: 'Address bookmarks' }
	];

	async function handleSave() {
		// Validate form - don't show toast, just inline errors
		if (!validateForm()) {
			return;
		}

		const activeTab = $syncSettingsStore.activeTab;
		isValidating = true;
		clearLogs();

		try {
			// Validate credentials based on active tab
			if (activeTab === 'github') {
				const result = await validateGitHubCredentials({
					token: $syncSettingsStore.github.token,
					gist: $syncSettingsStore.github.gist,
					encryptPassword: $syncSettingsStore.github.encryptPassword,
					onLog: addLog
				});

				if (result.success) {
					// Save validated credentials snapshot
					validatedGithubCredentials = {
						token: $syncSettingsStore.github.token,
						gist: $syncSettingsStore.github.gist,
						encryptPassword: $syncSettingsStore.github.encryptPassword
					};
					// Update validation status and save
					syncSettingsStore.setValidated('github', true);
					await saveSyncSettings({
						...$syncSettingsStore,
						github: { ...$syncSettingsStore.github, isValidated: true }
					});
					addLog('Settings saved and validated!', 'success');
				} else {
					// Validation failed - reset status
					syncSettingsStore.setValidated('github', false);
					await saveSyncSettings({
						...$syncSettingsStore,
						github: { ...$syncSettingsStore.github, isValidated: false }
					});
					addLog(`Validation failed: ${result.message}`, 'error');
				}
			} else {
				// Other tabs: just save (validation not implemented yet)
				await saveSyncSettings($syncSettingsStore);
				toast.success('Sync settings saved');
			}
		} catch (error) {
			console.error('❌ Failed to save sync settings:', error);
			addLog(`Error: ${error.message}`, 'error');
			toast.error('Failed to save sync settings');
		} finally {
			isValidating = false;
		}
	}

	async function handleUpload() {
		// Switch to upload tab
		activeLogTab = 'upload';

		// Add separator for new action
		const uploadLogs = $syncLogsStore.filter(log => log.logType === 'upload');
		if (uploadLogs.length > 0) {
			addLog('', 'separator', 'upload');
		}
		addLog('═══════════════════════════════════════', 'separator', 'upload');

		if (!validateForm()) {
			addLog('Validation failed - please fill in all required fields', 'error', 'upload');
			return;
		}

		const activeTab = $syncSettingsStore.activeTab;

		try {
			const hostsData = $hostsStore;
			const snippetsData = $snippetsStore;
			const keychainData = $keychainStore;
			const syncOptions = $syncSettingsStore.syncOptions;

			// Log summary based on selected options
			const uploadAddLog = (message, type) => addLog(message, type, 'upload');
			const partsIncluded = [];
			addLog('─────────────────────────────────────', 'info', 'upload');
			addLog('📦 Upload Summary:', 'info', 'upload');
			if (syncOptions.profiles && hostsData.hosts) {
				partsIncluded.push('hosts');
				addLog(`  • Hosts: ${hostsData.hosts?.length || 0} item(s)`, 'info', 'upload');
			}
			if (syncOptions.addressBookmarks && hostsData.groups) {
				partsIncluded.push('groups');
				addLog(`  • Groups: ${hostsData.groups?.length || 0} item(s)`, 'info', 'upload');
			}
			if (syncOptions.quickCommands && snippetsData?.snippets) {
				partsIncluded.push('snippets');
				addLog(`  • Snippets: ${snippetsData.snippets?.length || 0} item(s)`, 'info', 'upload');
			}
			if (keychainData?.keys?.length) {
				partsIncluded.push('keychain');
				addLog(`  • Keychain: ${keychainData.keys.length} key(s)`, 'info', 'upload');
			}
			if (syncOptions.settings) {
				partsIncluded.push('settings');
				addLog('  • Settings & Metadata: included', 'info', 'upload');
			}
			addLog(`Total parts: ${partsIncluded.length}`, 'info', 'upload');
			addLog('─────────────────────────────────────', 'info', 'upload');

			if (partsIncluded.length === 0) {
				addLog('No sync items selected. Please select at least one item.', 'error', 'upload');
				toast.error('Select at least one sync item to upload');
				return;
			}

			const result = await performUpload({
				hostsData,
				snippetsData,
				keychainData,
				syncOptions,
				onLog: uploadAddLog,
				source: 'rermius'
			});

			await handleUploadResult(result, uploadAddLog);
		} catch (error) {
			console.error('Upload failed:', error);
			addLog(`Upload failed: ${error.message}`, 'error', 'upload');
			toast.error('Upload failed');
		}
	}

	async function handleUploadResult(result, uploadAddLog) {
		if (result.success) {
			// Persist provider ID (e.g., gistId) if newly created
			if (result.providerId && !$syncSettingsStore.github.gist) {
				syncSettingsStore.updateGithub({ gist: result.providerId });
				await saveSyncSettings($syncSettingsStore);
				addLog(`Saved provider ID: ${result.providerId}`, 'info', 'upload');
			}

			// Update version state based on latest metadata
			if (result.latestVersion) {
				syncVersionStore.setLastKnownVersion(result.latestVersion);
				if (result.latestTimestamp) {
					syncVersionStore.setRemoteVersion(result.latestVersion, result.latestTimestamp);
				}
			}

			// Update last upload time
			syncSettingsStore.updateLastSync({ lastUpload: Date.now() });
			await saveSyncSettings($syncSettingsStore);

			// Clear new version indicator since we just uploaded (we are now the latest)
			syncVersionStore.clearNewVersionIndicator();

			toast.success('Upload successful!');
		} else {
			addLog(`Upload failed: ${result.message}`, 'error', 'upload');
			throw new Error(result.message);
		}
	}

	async function handleDownload() {
		// Switch to download tab
		activeLogTab = 'download';

		// Add separator for new action
		const downloadLogs = $syncLogsStore.filter(log => log.logType === 'download');
		if (downloadLogs.length > 0) {
			addLog('', 'separator', 'download');
		}
		addLog('═══════════════════════════════════════', 'separator', 'download');

		isDownloading = true;

		try {
			const downloadAddLog = (message, type) => addLog(message, type, 'download');
			const result = await performDownload({ onLog: downloadAddLog });

			if (result.success) {
				// Store the downloaded data for confirmation (may contain hosts, groups, settings, snippets, keychain)
				pendingDownloadData = result.data;

				const localHostsCount = $hostsStore.hosts?.length || 0;
				const localGroupsCount = $hostsStore.groups?.length || 0;
				const localSnippetsCount = $snippetsStore.snippets?.length || 0;
				const localKeysCount = $keychainStore.keys?.length || 0;

				const remoteHostsCount = result.data.hosts?.length || 0;
				const remoteGroupsCount = result.data.groups?.length || 0;
				const remoteSnippetsCount = result.data.snippets?.length || 0;
				const remoteKeysCount = result.data.keys?.length || 0;

				addLog(
					`Ready to import - Local: hosts=${localHostsCount}, groups=${localGroupsCount}, snippets=${localSnippetsCount}, keys=${localKeysCount}`,
					'info',
					'download'
				);
				addLog(
					`Ready to import - Remote: hosts=${remoteHostsCount}, groups=${remoteGroupsCount}, snippets=${remoteSnippetsCount}, keys=${remoteKeysCount}`,
					'info',
					'download'
				);

				if (result.data.settings || result.data.metadata) {
					addLog(
						'Downloaded settings & metadata are also available for import',
						'info',
						'download'
					);
				}

				addLog(
					'Click "Confirm Import" to apply ALL downloaded parts (hosts, groups, snippets, keychain, settings, metadata)',
					'warning',
					'download'
				);
			} else {
				addLog(`Download failed: ${result.message}`, 'error', 'download');
				toast.error(result.message);
			}
		} catch (error) {
			console.error('Download failed:', error);
			addLog(`Error: ${error.message}`, 'error', 'download');
			toast.error('Download failed');
		} finally {
			isDownloading = false;
		}
	}

	async function confirmDownload() {
		if (!pendingDownloadData) return;

		addLog('Applying downloaded data...', 'info', 'download');

		try {
			// Merge downloaded hosts/groups into current hosts store
			const currentHosts = get(hostsStore);
			const mergedHosts = {
				...currentHosts,
				// Only merge hosts, groups, settings, metadata, version (exclude snippets/keychain)
				...(pendingDownloadData.hosts && { hosts: pendingDownloadData.hosts }),
				...(pendingDownloadData.groups && { groups: pendingDownloadData.groups }),
				...(pendingDownloadData.settings && { settings: pendingDownloadData.settings }),
				...(pendingDownloadData.metadata && { metadata: pendingDownloadData.metadata }),
				...(pendingDownloadData.version && { version: pendingDownloadData.version })
			};

			hostsStore.set(mergedHosts);
			await saveHosts();
			addLog('Hosts & groups applied', 'success', 'download');

			// Apply snippets if present
			if (pendingDownloadData.snippets && Array.isArray(pendingDownloadData.snippets)) {
				const currentSnippets = get(snippetsStore);
				snippetsStore.set({
					...currentSnippets,
					snippets: pendingDownloadData.snippets
				});
				await saveSnippets();
				addLog(
					`Snippets applied: ${pendingDownloadData.snippets.length} item(s)`,
					'success',
					'download'
				);
			}

			// Apply keychain if present
			if (pendingDownloadData.keys && Array.isArray(pendingDownloadData.keys)) {
				const currentKeychain = get(keychainStore);
				keychainStore.set({
					...currentKeychain,
					keys: pendingDownloadData.keys,
					...(pendingDownloadData.vaults && { vaults: pendingDownloadData.vaults })
				});
				await saveKeychain();
				addLog(
					`Keychain applied: ${pendingDownloadData.keys.length} key(s)`,
					'success',
					'download'
				);
			}

			// Check if we need to force push to Gist
			const shouldForceGist = pendingDownloadData._forceGist;

			// Update last download time
			syncSettingsStore.updateLastSync({
				lastDownload: Date.now()
			});
			await saveSyncSettings($syncSettingsStore);

			addLog('Local data updated successfully.', 'success', 'download');

			if (shouldForceGist) {
				addLog('Pushing to Gist...', 'info', 'download');
				// Trigger upload with the restored data
				await handleUpload();
				addLog('Gist updated to this version.', 'success', 'download');
			}

			toast.success('Data imported successfully!');

			// Mark this version as synced and clear the indicator
			const versionState = get(syncVersionStore);
			const syncedVersion = versionState.latestRemoteVersion || pendingDownloadData.version;
			if (syncedVersion) {
				syncVersionStore.setLastKnownVersion(syncedVersion);
				// Keep remote version/timestamp aligned so badge stays cleared
				if (versionState.latestRemoteTimestamp) {
					syncVersionStore.setRemoteVersion(syncedVersion, versionState.latestRemoteTimestamp);
				}
			}
			syncVersionStore.clearNewVersionIndicator();

			pendingDownloadData = null;
		} catch (error) {
			console.error('Failed to apply downloaded data:', error);
			addLog(`Failed to save: ${error.message}`, 'error', 'download');
			toast.error('Failed to save downloaded data');
		}
	}

	function cancelDownload() {
		pendingDownloadData = null;
		addLog('Download cancelled', 'info', 'download');
	}

	async function handleAutoSyncToggle(enabled) {
		syncSettingsStore.updateAutoSync({ enabled });
		await saveSyncSettings($syncSettingsStore);
		if (enabled) {
			addLog('Auto sync enabled', 'success');
		} else {
			addLog('Auto sync disabled', 'info');
		}
	}

	async function handleShowHistory() {
		if (!$syncSettingsStore.github.gist?.trim()) {
			toast.error('No gist ID configured');
			return;
		}

		showHistory = true;
		historyPage = 1;
		await fetchHistoryPage(1);
	}

	async function fetchHistoryPage(page) {
		historyLoading = true;

		try {
			const result = await getGistHistory(
				$syncSettingsStore.github.token,
				$syncSettingsStore.github.gist,
				page,
				HISTORY_PER_PAGE
			);

			if (result.success) {
				historyList = result.commits;
				historyHasMore = result.hasMore;
				historyPage = page;
			} else {
				toast.error(result.message);
			}
		} catch (error) {
			toast.error('Failed to load history');
		} finally {
			historyLoading = false;
		}
	}

	async function refreshHistory() {
		await fetchHistoryPage(historyPage);
	}

	function handleRollback(sha) {
		rollbackSha = sha;
		showRollbackOptions = true;
	}

	async function doRollback(forceGist = false) {
		const sha = rollbackSha;
		showRollbackOptions = false;
		showHistory = false;
		selectedVersion = sha;
		clearLogs();
		addLog(`Rolling back to version ${sha.substring(0, 7)}...`, 'info');

		try {
			const result = await downloadGistVersion({
				token: $syncSettingsStore.github.token,
				gistId: $syncSettingsStore.github.gist,
				sha,
				encryptPassword: $syncSettingsStore.github.encryptPassword,
				onLog: addLog
			});

			if (result.success) {
				if (forceGist) {
					// Force push to Gist: apply locally then upload
					pendingDownloadData = { ...result.data, _forceGist: true };
					addLog(
						'Version downloaded. Click "Confirm Import" to apply and push to Gist.',
						'warning'
					);
				} else {
					pendingDownloadData = result.data;
					addLog('Version downloaded. Click "Confirm Import" to apply locally.', 'warning');
				}
			} else {
				addLog(`Rollback failed: ${result.message}`, 'error');
				toast.error(result.message);
			}
		} catch (error) {
			addLog(`Error: ${error.message}`, 'error');
			toast.error('Rollback failed');
		} finally {
			selectedVersion = null;
			rollbackSha = null;
		}
	}

	function cancelRollbackOptions() {
		showRollbackOptions = false;
		rollbackSha = null;
	}

	function closeHistory() {
		showHistory = false;
		historyList = [];
		historyPage = 1;
		historyHasMore = false;
	}
</script>

<div class="flex h-full">
	<!-- Left: Settings Form -->
	<ScrollArea class="flex-1 flex flex-col border-t border-border">
		<div class="p-6 gap-6 flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-bold text-white">Sync Settings</h2>
				<div class="flex gap-2">
					<Button variant="secondary" onclick={() => {}}>
						<span class="text-sm">Export</span>
					</Button>
					<Button variant="secondary" onclick={() => {}}>
						<span class="text-sm">Import from file</span>
					</Button>
				</div>
			</div>

			<!-- Tabs -->
			<div class="flex gap-2 border-b border-border bg-bg-secondary">
				{#each tabs as tab (tab.id)}
					<button
						type="button"
						onclick={() => syncSettingsStore.setActiveTab(tab.id)}
						class="px-4 py-2 text-sm font-medium transition-colors {$syncSettingsStore.activeTab ===
						tab.id
							? 'text-active border-b-2 border-active'
							: 'text-white/50 hover:text-white/70'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<!-- GitHub Tab -->
			{#if $syncSettingsStore.activeTab === 'github'}
				<div class="flex flex-col gap-4">
					<!-- Token -->
					<div class="flex flex-col gap-2">
						<label class="text-xs text-white/70" for="github-token">
							Token <span class="text-red-500">*</span>
						</label>
						<PasswordInput
							id="github-token"
							bind:value={$syncSettingsStore.github.token}
							placeholder="Enter GitHub personal access token"
							error={!!errors.github.token}
						/>
						<FieldError error={errors.github.token} />
					</div>

					<!-- Gist ID -->
					<div class="flex flex-col gap-2">
						<label class="text-xs text-white/70" for="github-gist">Gist</label>
						<Input
							id="github-gist"
							bind:value={$syncSettingsStore.github.gist}
							placeholder="Gist ID (optional, auto-generated if empty)"
						/>
						<FieldError error={errors.github.gist} />
					</div>

					<!-- Encrypt Password -->
					<div class="flex flex-col gap-2">
						<label class="text-xs text-white/70" for="github-encrypt">
							Encrypt Password <span class="text-red-500">*</span>
						</label>
						<PasswordInput
							id="github-encrypt"
							bind:value={$syncSettingsStore.github.encryptPassword}
							placeholder="Password to encrypt sync data"
							error={!!errors.github.encryptPassword}
						/>
						<FieldError error={errors.github.encryptPassword} />
					</div>

					<!-- Action Buttons -->
					<div class="flex gap-2">
						<Button variant="primary" onclick={handleSave} disabled={isValidating}>
							{isValidating ? 'Validating...' : 'Save'}
						</Button>
						<Button
							variant="secondary"
							onclick={handleUpload}
							disabled={!$syncSettingsStore.github.isValidated || isValidating}
							title={!$syncSettingsStore.github.isValidated
								? 'Save and validate credentials first'
								: ''}
						>
							Upload settings
						</Button>
						<Button
							variant="secondary"
							onclick={handleDownload}
							disabled={!$syncSettingsStore.github.isValidated || isValidating || isDownloading}
							title={!$syncSettingsStore.github.isValidated
								? 'Save and validate credentials first'
								: ''}
						>
							<span class="relative inline-flex items-center gap-1">
								{isDownloading ? 'Downloading...' : 'Download settings'}
								{#if $hasNewSyncVersion}
									<span
										class="absolute -top-1 -right-3 w-2 h-2 bg-red-500 rounded-full"
										aria-label="New version available"
									></span>
								{/if}
							</span>
						</Button>
						<Button
							variant="secondary"
							onclick={handleShowHistory}
							disabled={!$syncSettingsStore.github.isValidated || !$syncSettingsStore.github.gist}
							title="View upload history and rollback"
						>
							History
						</Button>
					</div>

					<!-- New Version Notification -->
					{#if $hasNewSyncVersion}
						<div
							class="text-xs text-blue-400 bg-blue-400/10 px-3 py-2 rounded flex items-center gap-2"
						>
							<span class="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
							<span>New version detected on remote. Click "Download settings" to sync.</span>
						</div>
					{/if}

					<!-- Validation Status -->
					{#if !$syncSettingsStore.github.isValidated}
						<div class="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded">
							⚠️ Click "Save" to validate your credentials and enable Upload/Download
						</div>
					{:else}
						<div class="text-xs text-green-400 bg-green-400/10 px-3 py-2 rounded">
							✓ Credentials validated - Upload and Download enabled
						</div>
					{/if}

					<!-- Auto Sync Toggle -->
					<div class="flex items-center justify-between py-2">
						<div class="flex flex-col gap-1">
							<span class="text-sm text-white">Auto sync on data change</span>
							<span class="text-xs text-white/50"
								>Automatically upload when hosts/settings change</span
							>
						</div>
						<Switch
							bind:checked={$syncSettingsStore.autoSync.enabled}
							disabled={!$syncSettingsStore.github.isValidated}
							onchange={handleAutoSyncToggle}
						/>
					</div>

					<!-- Status -->
					{#if $syncSettingsStore.lastSync.lastUpload || $syncSettingsStore.lastSync.lastDownload}
						<div class="flex flex-col gap-2 text-xs text-white/50">
							{#if $syncSettingsStore.lastSync.lastUpload}
								<div>
									Last upload: {new Date($syncSettingsStore.lastSync.lastUpload).toLocaleString()}
								</div>
							{/if}
							{#if $syncSettingsStore.lastSync.lastDownload}
								<div>
									Last download: {new Date(
										$syncSettingsStore.lastSync.lastDownload
									).toLocaleString()}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Check Gist Link -->
					{#if $syncSettingsStore.github.gist}
						<a
							href="https://gist.github.com/{$syncSettingsStore.github.gist}"
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs text-active hover:underline"
						>
							Check gist ↗
						</a>
					{/if}

					<!-- Sync Options - Hidden -->
					<!--
			<div class="flex flex-col gap-2">
				<span class="text-xs text-white/70">Sync Items</span>
				<div class="flex flex-wrap gap-4">
						{#each syncOptions as option (option.key)}
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={$syncSettingsStore.syncOptions[option.key]}
								class="w-4 h-4 rounded border-border bg-(--color-bg-tertiary) text-active focus:ring-active focus:ring-offset-0"
							/>
							<span class="text-sm text-white/70">{option.label}</span>
						</label>
					{/each}
				</div>
			</div>
			-->
				</div>
			{:else}
				<!-- Placeholder for other tabs -->
				<div class="flex items-center justify-center h-64">
					<p class="text-white/50">Coming soon...</p>
				</div>
			{/if}
		</div>
	</ScrollArea>
	<!-- End Left Panel -->

	<!-- History Modal -->
	{#if showHistory}
		<div
			class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
			role="presentation"
			tabindex="-1"
			onclick={closeHistory}
			onkeydown={event => {
				if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					closeHistory();
				}
			}}
		>
			<div
				class="bg-[#1E2235] rounded-lg w-[500px] max-h-[70vh] flex flex-col"
				role="dialog"
				tabindex="-1"
				onclick={e => e.stopPropagation()}
				onkeydown={event => {
					if (event.key === 'Escape') {
						event.preventDefault();
						closeHistory();
					}
				}}
			>
				<div class="p-4 border-b border-border bg-bg-secondary flex items-center justify-between">
					<h3 class="text-lg font-semibold text-white">Upload History</h3>
					<div class="flex items-center gap-2">
						<button
							onclick={refreshHistory}
							disabled={historyLoading}
							class="text-white/50 hover:text-white disabled:opacity-30"
							title="Refresh"
						>
							<svg
								class="w-4 h-4 {historyLoading ? 'animate-spin' : ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
						</button>
						<button onclick={closeHistory} class="text-white/50 hover:text-white text-xl"
							>&times;</button
						>
					</div>
				</div>
				<ScrollArea class="flex-1">
					<div class="p-4">
						{#if historyLoading}
							<p class="text-white/50 text-center py-8">Loading history...</p>
						{:else if historyList.length === 0}
							<p class="text-white/50 text-center py-8">No upload history found</p>
						{:else}
							<div class="flex flex-col gap-2">
								{#each historyList as commit (commit.sha)}
									<div
										class="flex items-center justify-between p-3 bg-(--color-bg-tertiary) rounded hover:bg-[#353A4D] transition-colors"
									>
										<div class="flex flex-col gap-1">
											<span class="text-sm text-white font-mono">
												{commit.sha.substring(0, 7)}
												{#if commit.isLatest}
													<span class="ml-2 text-xs text-green-400">(latest)</span>
												{/if}
											</span>
											<span class="text-xs text-white/50">
												{new Date(commit.date).toLocaleString()}
											</span>
										</div>
										<Button
											variant="secondary"
											size="sm"
											onclick={() => handleRollback(commit.sha)}
											disabled={selectedVersion === commit.sha ||
												($syncVersionStore.lastKnownVersion &&
													commit.sha === $syncVersionStore.lastKnownVersion)}
										>
											{selectedVersion === commit.sha
												? 'Loading...'
												: $syncVersionStore.lastKnownVersion &&
													  commit.sha === $syncVersionStore.lastKnownVersion
													? 'Current'
													: 'Rollback'}
										</Button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</ScrollArea>
				<!-- Pagination -->
				{#if historyList.length > 0}
					<div class="p-3 border-t border-border bg-bg-secondary flex items-center justify-between">
						<Button
							variant="secondary"
							size="sm"
							onclick={() => fetchHistoryPage(historyPage - 1)}
							disabled={historyPage <= 1 || historyLoading}
						>
							← Prev
						</Button>
						<span class="text-sm text-white/50">Page {historyPage}</span>
						<Button
							variant="secondary"
							size="sm"
							onclick={() => fetchHistoryPage(historyPage + 1)}
							disabled={!historyHasMore || historyLoading}
						>
							Next →
						</Button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Rollback Options Modal -->
	{#if showRollbackOptions}
		<div
			class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
			role="presentation"
			tabindex="-1"
			onclick={cancelRollbackOptions}
			onkeydown={event => {
				if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					cancelRollbackOptions();
				}
			}}
		>
			<div
				class="bg-[#1E2235] rounded-lg w-[400px] p-5"
				role="dialog"
				tabindex="-1"
				onclick={e => e.stopPropagation()}
				onkeydown={event => {
					if (event.key === 'Escape') {
						event.preventDefault();
						cancelRollbackOptions();
					}
				}}
			>
				<h3 class="text-lg font-semibold text-white mb-4">Rollback Options</h3>
				<p class="text-sm text-white/70 mb-4">
					Version: <span class="font-mono text-active">{rollbackSha?.substring(0, 7)}</span>
				</p>
				<div class="flex flex-col gap-3">
					<button
						onclick={() => doRollback(false)}
						class="w-full p-3 text-left rounded bg-(--color-bg-tertiary) hover:bg-[#353A4D] transition-colors"
					>
						<div class="text-sm font-medium text-white">Restore Local Only</div>
						<div class="text-xs text-white/50 mt-1">
							Download this version and apply to local data. Gist remains unchanged.
						</div>
					</button>
					<button
						onclick={() => doRollback(true)}
						class="w-full p-3 text-left rounded bg-(--color-bg-tertiary) hover:bg-[#353A4D] transition-colors"
					>
						<div class="text-sm font-medium text-white">Restore & Push to Gist</div>
						<div class="text-xs text-white/50 mt-1">
							Download this version, apply locally, then upload to Gist (creates new commit).
						</div>
					</button>
				</div>
				<button onclick={cancelRollbackOptions} class="mt-4 text-sm text-white/50 hover:text-white"
					>Cancel</button
				>
			</div>
		</div>
	{/if}

	<!-- Right: Sync Logs Panel -->
	<div class="w-96 flex flex-col border-l border-border bg-bg-secondary">
		<div class="p-4 border-b border-border bg-bg-secondary flex items-center justify-between">
			<h3 class="text-sm font-semibold text-white">Sync Logs</h3>
			{#if $syncLogsStore.length > 0}
				<button
					onclick={clearLogs}
					class="text-xs text-white/50 hover:text-white transition-colors"
					title="Clear all logs"
				>
					Clear All
				</button>
			{/if}
		</div>

		<!-- Log Tabs -->
		<div class="flex gap-0 border-b border-border bg-bg-tertiary">
			<button
				type="button"
				onclick={() => (activeLogTab = 'upload')}
				class="flex-1 px-3 py-2 text-xs font-medium transition-colors {activeLogTab === 'upload'
					? 'text-active bg-bg-secondary border-b-2 border-active'
					: 'text-white/50 hover:text-white/70'}"
			>
				Upload
			</button>
			<button
				type="button"
				onclick={() => (activeLogTab = 'download')}
				class="flex-1 px-3 py-2 text-xs font-medium transition-colors {activeLogTab === 'download'
					? 'text-active bg-bg-secondary border-b-2 border-active'
					: 'text-white/50 hover:text-white/70'}"
			>
				Download
			</button>
		</div>

		<ScrollArea class="flex-1 bg-[#1a1d2e]">
			<div class="p-4 font-mono text-xs" bind:this={logsContainer}>
				{#if filteredLogs.length === 0}
					<p class="text-white/30 italic">
						{#if activeLogTab === 'upload'}
							No upload logs yet. Click "Upload settings" to start.
						{:else}
							No download logs yet. Click "Download settings" to start.
						{/if}
					</p>
				{:else}
					{#each filteredLogs as log (log.id)}
						{#if log.type === 'separator'}
							<div class="mb-2 text-white/20">
								{log.message}
							</div>
						{:else}
							<div
								class="mb-2 {log.type === 'error'
									? 'text-red-400'
									: log.type === 'success'
										? 'text-green-400'
										: log.type === 'warning'
											? 'text-yellow-400'
											: 'text-white/70'}"
							>
								<span class="text-white/40">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
								{log.message}
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		</ScrollArea>

		<!-- Download Confirmation Actions -->
		{#if pendingDownloadData}
			<div class="p-4 border-t border-border bg-bg-secondary">
				<div class="text-xs text-yellow-400 mb-3 space-y-1">
					<div>⚠️ You are about to import the following data from backup:</div>

					{#if Array.isArray(pendingDownloadData.hosts)}
						<div>
							• Hosts: {pendingDownloadData.hosts.length} item(s)
						</div>
					{/if}

					{#if Array.isArray(pendingDownloadData.groups)}
						<div>
							• Groups: {pendingDownloadData.groups.length} item(s)
						</div>
					{/if}

					{#if Array.isArray(pendingDownloadData.snippets)}
						<div>
							• Snippets: {pendingDownloadData.snippets.length} item(s)
						</div>
					{/if}

					{#if Array.isArray(pendingDownloadData.keys)}
						<div>
							• Keychain: {pendingDownloadData.keys.length} key(s)
							{#if Array.isArray(pendingDownloadData.vaults)}
								({pendingDownloadData.vaults.length} vault(s))
							{/if}
						</div>
					{/if}

					{#if pendingDownloadData.settings}
						<div>• Settings: will overwrite local connection defaults & sync-related settings</div>
					{/if}

					{#if pendingDownloadData.metadata}
						<div>• Metadata: version & timestamps will be updated</div>
					{/if}

					<div class="mt-1">
						All available parts above will be imported together with a single action.
					</div>
				</div>
				<div class="flex gap-2">
					<Button variant="danger" size="sm" onclick={confirmDownload}>Confirm Import</Button>
					<Button variant="secondary" size="sm" onclick={cancelDownload}>Cancel</Button>
				</div>
			</div>
		{/if}
	</div>
</div>
