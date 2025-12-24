<!--
@component KeyScanModal
Main modal component for scanning and importing SSH keys from folder
-->
<script>
	import { Modal, ModalHeader, ModalBody, ModalFooter } from '$lib/components/ui/Modal';
	import { Button } from '$lib/components/ui/Button';
	import { useKeyScan } from '$lib/composables/useKeyScan.svelte.js';
	import KeyScanFileList from './KeyScanFileList.svelte';
	import KeyScanProgress from './KeyScanProgress.svelte';
	import KeyScanSummary from './KeyScanSummary.svelte';
	import { Loader2 } from 'lucide-svelte';

	let { open = $bindable(false), onImportComplete } = $props();

	const keyScan = useKeyScan();

	let showSummary = $state(false);
	let importSummary = $state(null);
	let previewTypes = $state(new Map());
	let warnings = $state(new Set());
	let searchQuery = $state('');

	// Debug: log summary changes
	$effect(() => {
		if (showSummary && importSummary) {
			console.log('[KeyScanModal] Summary state:', importSummary);
		}
	});

	// Preview key types for visible files (lazy loading)
	$effect(() => {
		if (keyScan.files.length > 0 && !keyScan.isScanning) {
			// Preview types for first 10 files to avoid blocking
			const filesToPreview = keyScan.files.slice(0, 10);
			filesToPreview.forEach(async file => {
				if (!previewTypes.has(file.path)) {
					const keyType = await keyScan.getPreviewType(file.path);
					previewTypes.set(file.path, keyType);
					previewTypes = new Map(previewTypes); // Trigger reactivity
				}
			});
		}
	});

	async function handleScanFolder() {
		try {
			await keyScan.openAndScanFolder();
		} catch (error) {
			console.error('Failed to scan folder:', error);
		}
	}

	async function handleImport() {
		try {
			const summary = await keyScan.importSelected();
			console.log('[KeyScanModal] Received summary:', summary);
			console.log('[KeyScanModal] Summary imported:', summary.imported);
			console.log('[KeyScanModal] Summary duplicates:', summary.duplicates);
			console.log('[KeyScanModal] Summary errors:', summary.errors);

			// Create new object to ensure reactivity
			importSummary = {
				imported: summary.imported || 0,
				duplicates: summary.duplicates || 0,
				errors: summary.errors || 0,
				errorDetails: summary.errorDetails || []
			};

			console.log('[KeyScanModal] Set importSummary to:', importSummary);
			showSummary = true;
			onImportComplete?.(summary);
		} catch (error) {
			console.error('Failed to import keys:', error);
			importSummary = {
				imported: 0,
				duplicates: 0,
				errors: 1,
				errorDetails: [{ path: 'Unknown', error: error.message || String(error) }]
			};
			showSummary = true;
		}
	}

	function handleClose() {
		open = false;
		keyScan.reset();
		showSummary = false;
		importSummary = null;
		previewTypes = new Map();
		warnings = new Set();
		searchQuery = '';
	}

	function handleSummaryClose() {
		showSummary = false;
		if (!keyScan.isImporting) {
			handleClose();
		}
	}

	const selectedCount = $derived(keyScan.selectedFiles.size);
	const canImport = $derived(selectedCount > 0 && !keyScan.isImporting);
</script>

<Modal bind:open size="xl" onclose={handleClose}>
	<ModalHeader title="Scan Folder for SSH Keys" onclose={handleClose} />

	<ModalBody>
		{#if keyScan.isScanning}
			<div class="flex flex-col items-center justify-center py-12">
				<Loader2 size={32} class="text-primary animate-spin mb-4" />
				<p class="text-sm text-text-secondary">Scanning folder...</p>
			</div>
		{:else if keyScan.files.length === 0}
			<div class="flex flex-col items-center justify-center py-12">
				<p class="text-sm text-text-secondary mb-4">No SSH key files found.</p>
				<Button onclick={handleScanFolder} variant="secondary">
					<span>Select Folder</span>
				</Button>
			</div>
		{:else}
			<KeyScanFileList
				files={keyScan.files}
				selectedFiles={keyScan.selectedFiles}
				bind:searchQuery
				{previewTypes}
				{warnings}
				onToggle={path => keyScan.toggleFile(path)}
				onToggleAll={() => keyScan.toggleAll()}
			/>

			{#if keyScan.isImporting}
				<div class="mt-4">
					<KeyScanProgress
						current={keyScan.importProgress.current}
						total={keyScan.importProgress.total}
						success={keyScan.importProgress.success}
						errors={keyScan.importProgress.errors}
						duplicates={keyScan.importProgress.duplicates}
					/>
				</div>
			{/if}
		{/if}
	</ModalBody>

	<ModalFooter>
		<div class="flex items-center justify-between w-full">
			<Button variant="ghost" onclick={handleClose} disabled={keyScan.isImporting}>Cancel</Button>
			<div class="flex items-center gap-2">
				{#if keyScan.files.length === 0}
					<Button onclick={handleScanFolder} variant="secondary">
						<span>Select Folder</span>
					</Button>
				{:else}
					<Button onclick={handleImport} variant="primary" disabled={!canImport}>
						<span>Import {selectedCount > 0 ? `(${selectedCount})` : ''}</span>
					</Button>
				{/if}
			</div>
		</div>
	</ModalFooter>
</Modal>

<!-- Summary Modal -->
{#if importSummary}
	<KeyScanSummary bind:open={showSummary} summary={importSummary} onClose={handleSummaryClose} />
{/if}
