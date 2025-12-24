<!--
@component KeyScanSummary
Displays summary modal after import completion
-->
<script>
	import { Modal, ModalHeader, ModalBody, ModalFooter } from '$lib/components/ui/Modal';
	import { Button } from '$lib/components/ui/Button';
	import { ScrollArea } from '$lib/components/ui';
	import { CheckCircle, AlertCircle, XCircle } from 'lucide-svelte';

	let { open = $bindable(false), summary, onClose } = $props();

	// Ensure summary has default values if not provided
	const safeSummary = $derived({
		imported: summary?.imported || 0,
		duplicates: summary?.duplicates || 0,
		errors: summary?.errors || 0,
		errorDetails: summary?.errorDetails || []
	});

	// Debug: log summary when it changes
	$effect(() => {
		if (open) {
			console.log('[KeyScanSummary] Summary prop:', summary);
			console.log('[KeyScanSummary] Safe summary:', safeSummary);
			console.log('[KeyScanSummary] Imported count:', safeSummary.imported);
			console.log('[KeyScanSummary] Duplicates count:', safeSummary.duplicates);
			console.log('[KeyScanSummary] Errors count:', safeSummary.errors);
		}
	});

	// Derived values to ensure reactivity
	const importedCount = $derived(safeSummary.imported);
	const duplicatesCount = $derived(safeSummary.duplicates);
	const errorsCount = $derived(safeSummary.errors);
	const errorDetails = $derived(safeSummary.errorDetails);

	function handleClose() {
		open = false;
		onClose?.();
	}
</script>

<Modal bind:open size="md">
	<ModalHeader title="Import Summary" onclose={handleClose} />

	<ModalBody>
		<div class="flex flex-col gap-4">
			<!-- Success Count -->
			{#if importedCount > 0}
				<div
					class="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
				>
					<CheckCircle size={20} class="text-green-500" />
					<span class="text-sm text-text-primary">
						<strong>{importedCount}</strong> key{importedCount !== 1 ? 's' : ''} imported successfully
					</span>
				</div>
			{/if}

			<!-- Duplicates Count -->
			{#if duplicatesCount > 0}
				<div
					class="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg"
				>
					<AlertCircle size={20} class="text-orange-500" />
					<span class="text-sm text-text-primary">
						<strong>{duplicatesCount}</strong> duplicate key{duplicatesCount !== 1 ? 's' : ''}{' '}
						skipped
					</span>
				</div>
			{/if}

			<!-- Errors -->
			{#if errorsCount > 0}
				<div class="flex flex-col gap-2">
					<div
						class="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
					>
						<XCircle size={20} class="text-red-500" />
						<span class="text-sm text-text-primary">
							<strong>{errorsCount}</strong> error{errorsCount !== 1 ? 's' : ''} occurred
						</span>
					</div>

					<!-- Error Details -->
					{#if errorDetails && errorDetails.length > 0}
						<ScrollArea class="max-h-40">
							{#each errorDetails as errorDetail (errorDetail.path)}
								<div class="text-xs text-text-secondary p-2 bg-bg-tertiary rounded mb-1">
									<div class="font-medium truncate">{errorDetail.path}</div>
									<div class="text-red-400 mt-1">{errorDetail.error}</div>
								</div>
							{/each}
						</ScrollArea>
					{/if}
				</div>
			{/if}

			<!-- No Results -->
			{#if importedCount === 0 && duplicatesCount === 0 && errorsCount === 0}
				<div class="text-sm text-text-secondary text-center py-4">No keys were imported.</div>
			{/if}
		</div>
	</ModalBody>

	<ModalFooter>
		<Button variant="primary" onclick={handleClose} fullWidth>Close</Button>
	</ModalFooter>
</Modal>
