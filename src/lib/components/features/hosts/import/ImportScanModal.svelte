<!--
@component ImportScanModal
Modal for scanning SSH config file and importing hosts with optional key auto-import
-->
<script>
	import { Modal, ModalHeader, ModalBody, ModalFooter } from '$lib/components/ui/Modal';
	import { Button } from '$lib/components/ui/Button';
	import { Checkbox } from '$lib/components/ui';
	import { useSSHConfigScan } from '$lib/composables/useSSHConfigScan.svelte.js';
	import { useToast } from '$lib/composables/useToast.svelte.js';
	import ImportHostList from './ImportHostList.svelte';
	import { FileText, FolderOpen, Loader2 } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let { open = $bindable(false), onImportComplete } = $props();

	const sshConfigScan = useSSHConfigScan();
	const toast = useToast();
	let showSummary = $state(false);
	let importSummary = $state(null);
	let scanError = $state(null);

	function handleClose() {
		open = false;
		sshConfigScan.reset();
		showSummary = false;
		importSummary = null;
		scanError = null;
	}

	function handleSummaryClose() {
		showSummary = false;
		handleClose();
	}

	async function handleScanFile() {
		try {
			scanError = null;
			await sshConfigScan.openAndScanConfig();
		} catch (error) {
			console.error('Failed to scan SSH config:', error);
			const errorMessage = error?.message || String(error);
			scanError = errorMessage;
			toast.error(`Failed to scan SSH config: ${errorMessage}`);
		}
	}

	async function handleScanDefault() {
		try {
			scanError = null;
			await sshConfigScan.scanDefaultConfig();
		} catch (error) {
			console.error('Failed to scan default SSH config:', error);
			const errorMessage = error?.message || String(error);
			scanError = errorMessage;
			toast.error(`Failed to scan default SSH config: ${errorMessage}`);
		}
	}

	async function handleImport() {
		try {
			const summary = await sshConfigScan.importSelected();
			importSummary = {
				imported: summary.imported || 0,
				duplicates: summary.duplicates || 0,
				errors: summary.errors || 0,
				keysImported: summary.keysImported || 0,
				errorDetails: summary.errorDetails || [],
				failedKeys: summary.failedKeys || [],
				duplicateKeys: summary.duplicateKeys || []
			};
			showSummary = true;
			onImportComplete?.(summary);
		} catch (error) {
			console.error('Failed to import hosts:', error);
			importSummary = {
				imported: 0,
				duplicates: 0,
				errors: 1,
				keysImported: 0,
				errorDetails: [{ host: 'Unknown', error: error.message || String(error) }],
				failedKeys: [],
				duplicateKeys: []
			};
			showSummary = true;
		}
	}

	async function handleRetryKey(keyPath, index) {
		try {
			const result = await sshConfigScan.retryKeyImport(keyPath);
			if (result.success) {
				// Remove from failed list
				importSummary.failedKeys = importSummary.failedKeys.filter((_, i) => i !== index);
				importSummary.errors -= 1;

				if (result.isDuplicate) {
					// Add to duplicate list
					importSummary.duplicateKeys = [
						...importSummary.duplicateKeys,
						{
							path: keyPath,
							existingKey: result.key,
							keyType: result.key.keyType
						}
					];
				} else {
					// Successfully imported
					importSummary.keysImported += 1;
				}
			} else {
				// Update error message
				importSummary.failedKeys[index].error = result.error;
				importSummary.failedKeys = [...importSummary.failedKeys]; // Trigger reactivity
			}
		} catch (error) {
			console.error('Failed to retry key import:', error);
		}
	}

	async function handleOverwriteKey(keyPath, existingKeyId, index) {
		try {
			const result = await sshConfigScan.overwriteKey(keyPath, existingKeyId);
			if (result.success) {
				// Remove from duplicate list
				importSummary.duplicateKeys = importSummary.duplicateKeys.filter((_, i) => i !== index);
				// Increment imported count
				importSummary.keysImported += 1;
			} else {
				// Show error
				console.error('Failed to overwrite key:', result.error);
				alert(`Failed to overwrite key: ${result.error}`);
			}
		} catch (error) {
			console.error('Failed to overwrite key:', error);
			alert(`Failed to overwrite key: ${error.message || String(error)}`);
		}
	}

	const selectedCount = $derived(sshConfigScan.selectedCount);
	const hasHosts = $derived(sshConfigScan.hosts.length > 0);
</script>

<Modal bind:open size="lg">
	<ModalHeader title="Scan SSH Config" onclose={handleClose} />

	<ModalBody>
		{#if !hasHosts && !sshConfigScan.isScanning}
			<!-- Initial State: Scan Options -->
			<div class="flex flex-col gap-4">
				<div class="text-sm text-text-secondary">
					Select an SSH config file to scan for hosts and keys.
				</div>

				{#if scanError}
					<div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<div class="text-sm text-red-400 font-medium mb-1">Error</div>
						<div class="text-xs text-red-300 break-words">{scanError}</div>
					</div>
				{/if}

				<div class="flex flex-col gap-2">
					<Button variant="secondary" onclick={handleScanDefault} fullWidth>
						<FileText size={14} />
						Scan Default Config (~/.ssh/config)
					</Button>

					<Button variant="secondary" onclick={handleScanFile} fullWidth>
						<FolderOpen size={14} />
						Choose SSH Config File
					</Button>
				</div>
			</div>
		{:else if sshConfigScan.isScanning}
			<!-- Scanning State -->
			<div class="flex flex-col items-center justify-center py-8 gap-3">
				<Loader2 size={32} class="text-text-secondary animate-spin" />
				<span class="text-sm text-text-secondary">Scanning SSH config...</span>
			</div>
		{:else if showSummary && importSummary}
			<!-- Summary State -->
			<div class="flex flex-col gap-4">
				<div class="text-sm text-text-primary font-medium">Import Summary</div>

				<div class="flex flex-col gap-3">
					{#if importSummary.imported > 0}
						<div
							class="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded"
						>
							<span class="text-sm text-text-primary">
								✓ {importSummary.imported} host{importSummary.imported !== 1 ? 's' : ''} imported successfully
							</span>
						</div>
					{/if}

					{#if importSummary.keysImported > 0}
						<div
							class="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded"
						>
							<span class="text-sm text-text-primary">
								✓ {importSummary.keysImported} SSH key{importSummary.keysImported !== 1 ? 's' : ''} imported
								to keychain
							</span>
						</div>
					{/if}

					<!-- Failed Keys Section -->
					{#if importSummary.failedKeys && importSummary.failedKeys.length > 0}
						<div class="flex flex-col gap-2">
							<div
								class="flex items-center gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded"
							>
								<span class="text-sm text-text-primary">
									⚠ {importSummary.failedKeys.length} key{importSummary.failedKeys.length !== 1
										? 's'
										: ''} failed to import
								</span>
							</div>

							<div class="flex flex-col gap-2">
								<div class="text-xs font-medium text-text-secondary">Failed Keys:</div>
								<div class="max-h-60 border border-border rounded-lg bg-bg-secondary">
									<div class="p-3">
										<div class="flex flex-col gap-2">
											{#each importSummary.failedKeys as failedKey, index (failedKey.path)}
												<div class="text-xs p-2 bg-bg-tertiary rounded border border-orange-500/20">
													<div class="flex items-start justify-between gap-2 mb-1">
														<div class="flex-1">
															<div class="font-medium text-text-primary break-words">
																{failedKey.path.split(/[\\/]/).pop()}
															</div>
															<div class="text-text-secondary text-[10px] mt-0.5 break-all">
																{failedKey.path}
															</div>
														</div>
														<Button
															variant="primary"
															size="xs"
															onclick={() => handleRetryKey(failedKey.path, index)}
														>
															Retry
														</Button>
													</div>
													<div class="text-orange-400 break-words whitespace-pre-wrap">
														{failedKey.error}
													</div>
												</div>
											{/each}
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Duplicate Keys Section -->
					{#if importSummary.duplicateKeys && importSummary.duplicateKeys.length > 0}
						<div class="flex flex-col gap-2">
							<div
								class="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded"
							>
								<span class="text-sm text-text-primary">
									ℹ {importSummary.duplicateKeys.length} duplicate key{importSummary.duplicateKeys
										.length !== 1
										? 's'
										: ''} detected
								</span>
							</div>

							<div class="flex flex-col gap-2">
								<div class="text-xs font-medium text-text-secondary">Duplicate Keys:</div>
								<div class="max-h-60 border border-border rounded-lg bg-bg-secondary">
									<div class="p-3">
										<div class="flex flex-col gap-2">
											{#each importSummary.duplicateKeys as duplicateKey, index (duplicateKey.path)}
												<div class="text-xs p-2 bg-bg-tertiary rounded border border-yellow-500/20">
													<div class="flex items-start justify-between gap-2 mb-1">
														<div class="flex-1">
															<div class="font-medium text-text-primary break-words">
																{duplicateKey.path.split(/[\\/]/).pop()}
															</div>
															<div class="text-text-secondary text-[10px] mt-0.5 break-all">
																{duplicateKey.path}
															</div>
														</div>
														<Button
															variant="destructive"
															size="xs"
															onclick={() =>
																handleOverwriteKey(
																	duplicateKey.path,
																	duplicateKey.existingKey.id,
																	index
																)}
														>
															Overwrite
														</Button>
													</div>
													<div class="text-yellow-400 break-words">
														Already exists as: <span class="font-medium"
															>{duplicateKey.existingKey.label}</span
														>
													</div>
												</div>
											{/each}
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}

					{#if importSummary.errors > 0}
						<div class="flex flex-col gap-2">
							<div
								class="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded"
							>
								<span class="text-sm text-text-primary">
									✗ {importSummary.errors} error{importSummary.errors !== 1 ? 's' : ''} occurred
								</span>
							</div>

							<!-- Error Details - Always show if there are errors -->
							{#if importSummary.errorDetails && importSummary.errorDetails.length > 0}
								<div class="flex flex-col gap-2">
									<div class="text-xs font-medium text-text-secondary">Error Details:</div>
									<div class="max-h-60 border border-border rounded-lg bg-bg-secondary">
										<div class="p-3">
											<div class="flex flex-col gap-2">
												{#each importSummary.errorDetails as errorDetail (errorDetail.host || errorDetail.path || errorDetail)}
													<div class="text-xs p-2 bg-bg-tertiary rounded border border-red-500/20">
														<div class="font-medium text-text-primary mb-1 break-words">
															{errorDetail.host || errorDetail.path || 'Unknown'}
														</div>
														<div class="text-red-400 break-words whitespace-pre-wrap">
															{errorDetail.error}
														</div>
													</div>
												{/each}
											</div>
										</div>
									</div>
								</div>
							{:else}
								<div class="text-xs text-text-secondary italic">No error details available</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Host List State -->
			<div class="flex flex-col gap-4">
				<!-- Auto Import Keys Checkbox -->
				<div
					class="flex items-center gap-2 p-3 bg-bg-secondary border border-border rounded-lg shrink-0"
				>
					<Checkbox
						checked={sshConfigScan.autoImportKeys}
						onchange={checked => sshConfigScan.setAutoImportKeys(checked)}
					/>
					<div class="flex-1">
						<div class="text-sm font-medium text-text-primary">Auto import keychain</div>
						<div class="text-xs text-text-secondary">
							Automatically import SSH keys from identity files into keychain before importing hosts
						</div>
					</div>
				</div>

				<!-- Host List -->
				<ImportHostList
					hosts={sshConfigScan.hosts}
					selectedHosts={sshConfigScan.selectedHosts}
					onToggleHost={sshConfigScan.toggleHost}
					onToggleAll={sshConfigScan.toggleAll}
				/>

				<!-- Import Progress -->
				{#if sshConfigScan.isImporting}
					<div class="flex flex-col gap-2 p-3 bg-bg-secondary border border-border rounded-lg">
						<div class="flex items-center justify-between text-xs">
							<span class="text-text-secondary">Importing hosts...</span>
							<span class="text-text-primary">
								{sshConfigScan.importProgress.current} / {sshConfigScan.importProgress.total}
							</span>
						</div>
						<div class="w-full bg-bg-tertiary rounded-full h-1.5">
							<div
								class="bg-primary h-1.5 rounded-full transition-all duration-300"
								style="width: {sshConfigScan.importProgress.total > 0
									? (sshConfigScan.importProgress.current / sshConfigScan.importProgress.total) *
										100
									: 0}%"
							></div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</ModalBody>

	<ModalFooter>
		<div class="flex items-center justify-between w-full">
			<Button variant="ghost" onclick={handleClose} disabled={sshConfigScan.isImporting}>
				{showSummary ? 'Close' : 'Cancel'}
			</Button>

			{#if hasHosts && !showSummary}
				<Button
					variant="primary"
					onclick={handleImport}
					disabled={selectedCount === 0 || sshConfigScan.isImporting}
				>
					<span>Import {selectedCount > 0 ? `(${selectedCount})` : ''}</span>
				</Button>
			{/if}
		</div>
	</ModalFooter>
</Modal>
