<script>
	import {
		Modal,
		ModalHeader,
		ModalBody,
		ModalFooter,
		Button,
		Spinner,
		ScrollArea
	} from '$lib/components/ui';
	import { Trash2, AlertTriangle, Folder, File } from 'lucide-svelte';

	let {
		open = $bindable(false),
		files = [], // Array of files to delete
		deleting = false, // Loading state
		onConfirm,
		onCancel
	} = $props();

	function handleConfirm() {
		if (deleting) return; // Prevent action during delete
		onConfirm?.();
	}

	function handleCancel() {
		if (deleting) return; // Prevent cancel during delete
		open = false;
		onCancel?.();
	}
</script>

<Modal {open} size="md" onclose={handleCancel}>
	<ModalHeader title="Delete Items" onclose={handleCancel}>
		<div class="flex items-center gap-2">
			<Trash2 size={18} class="text-red-400" />
		</div>
	</ModalHeader>
	<ModalBody>
		<div class="flex flex-col gap-4">
			<div class="flex items-start gap-3 bg-red-500/20 border border-red-500/50 rounded-lg p-3">
				<AlertTriangle size={20} class="text-red-400 mt-0.5 shrink-0" />
				<div class="flex-1">
					<p class="text-sm text-white/90 font-medium mb-1">
						Are you sure you want to delete {files.length} item{files.length === 1 ? '' : 's'}?
					</p>
					<p class="text-xs text-white/60">This action cannot be undone.</p>
				</div>
			</div>

			<ScrollArea class="max-h-64">
				<div class="space-y-1">
					{#each files as file (file.path)}
						<div class="flex items-center gap-2 px-2 py-1.5 bg-border rounded text-sm">
							{#if file.isDirectory}
								<Folder size={14} class="text-primary shrink-0" />
							{:else}
								<File size={14} class="text-white/50 shrink-0" />
							{/if}
							<span class="text-white/80 truncate">{file.name}</span>
						</div>
					{/each}
				</div>
			</ScrollArea>
		</div>
	</ModalBody>
	<ModalFooter>
		<Button variant="ghost" onclick={handleCancel} disabled={deleting}>Cancel</Button>
		<Button variant="danger" onclick={handleConfirm} disabled={deleting}>
			{#if deleting}
				<div class="flex items-center gap-2">
					<Spinner size="sm" />
					<span>Deleting...</span>
				</div>
			{:else}
				Delete {files.length} item{files.length === 1 ? '' : 's'}
			{/if}
		</Button>
	</ModalFooter>
</Modal>
