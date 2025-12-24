<script>
	import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '$lib/components/ui';
	import { getFileIcon } from '$lib/utils/file-icons';
	import * as LucideIcons from 'lucide-svelte';

	let {
		open = $bindable(false),
		file = null,
		data = null,
		type = 'local',
		sessionId = null
	} = $props();

	function formatSize(bytes) {
		if (bytes === undefined || bytes === null) return '--';
		if (bytes === 0) return '0 B';

		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
	}

	function formatDate(timestamp) {
		if (!timestamp) return '--';
		try {
			const date = new Date(timestamp * 1000);
			if (isNaN(date.getTime())) return '--';
			return date.toLocaleString();
		} catch {
			return '--';
		}
	}

	function formatPermissions(mode) {
		if (!mode && mode !== 0) return '--';
		if (typeof mode === 'string') return mode;
		return mode.toString(8).padStart(4, '0');
	}

	function getIconComponent(file) {
		if (!file) return LucideIcons.File;
		const iconName = getFileIcon(file.name, file.isDirectory);
		const iconMap = {
			Folder: LucideIcons.Folder,
			FolderOpen: LucideIcons.FolderOpen,
			FileText: LucideIcons.FileText,
			FileCode: LucideIcons.FileCode,
			FileJson: LucideIcons.FileJson,
			Image: LucideIcons.Image,
			FileArchive: LucideIcons.Archive,
			Music: LucideIcons.Music,
			Video: LucideIcons.Video,
			File: LucideIcons.File
		};
		return iconMap[iconName] || LucideIcons.File;
	}

	const IconComponent = $derived(getIconComponent(file));

	function handleClose() {
		open = false;
	}
</script>

<Modal {open} size="md" onclose={handleClose}>
	<ModalHeader
		title={file ? (file.isDirectory ? 'Folder Properties' : 'File Properties') : 'Properties'}
		onclose={handleClose}
	/>
	<ModalBody>
		{#if file && data}
			<div class="flex flex-col gap-6">
				<!-- Icon and Name -->
				<div class="flex items-center gap-4 pb-4 border-b border-white/10">
					<div
						class="w-16 h-16 flex items-center justify-center rounded-lg bg-white/5 text-white/80 shrink-0"
					>
						{#if IconComponent}
							{@const Icon = IconComponent}
							<Icon size={40} />
						{/if}
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-white/60 text-xs uppercase tracking-wide mb-1">Name</p>
						<p class="text-white font-semibold text-lg truncate">{file.name}</p>
					</div>
				</div>

				<!-- Properties Grid -->
				<div class="grid grid-cols-2 gap-4">
					<!-- Type -->
					<div class="bg-white/5 rounded-lg p-3">
						<p class="text-white/60 text-xs uppercase tracking-wide mb-1.5">Type</p>
						<p class="text-white font-medium">{file.isDirectory ? 'Folder' : 'File'}</p>
					</div>

					<!-- Size -->
					{#if !file.isDirectory}
						<div class="bg-white/5 rounded-lg p-3">
							<p class="text-white/60 text-xs uppercase tracking-wide mb-1.5">Size</p>
							<p class="text-white font-medium">{formatSize(data.size)}</p>
						</div>
					{/if}

					<!-- Owner/Group (Remote only) -->
					{#if data.owner !== undefined}
						<div class="bg-white/5 rounded-lg p-3">
							<p class="text-white/60 text-xs uppercase tracking-wide mb-1.5">Owner</p>
							<p class="text-white font-medium">{data.owner || '--'}</p>
						</div>
					{/if}
					{#if data.group !== undefined}
						<div class="bg-white/5 rounded-lg p-3">
							<p class="text-white/60 text-xs uppercase tracking-wide mb-1.5">Group</p>
							<p class="text-white font-medium">{data.group || '--'}</p>
						</div>
					{/if}

					<!-- Permissions (Unix only, including FTP) -->
					{#if (data.mode !== undefined && data.mode !== null) || (data.permissions && typeof data.permissions === 'string')}
						<div class="bg-white/5 rounded-lg p-3 col-span-2">
							<p class="text-white/60 text-xs uppercase tracking-wide mb-1.5">Permissions</p>
							{#if data.mode !== undefined && data.mode !== null}
								<p class="text-white font-mono font-medium text-base">
									{formatPermissions(data.mode)}
								</p>
								{#if data.permissions && data.permissions !== formatPermissions(data.mode)}
									<p class="text-xs text-white/40 mt-1">{data.permissions}</p>
								{/if}
							{:else if data.permissions}
								<p class="text-white font-mono font-medium text-base">{data.permissions}</p>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Full Path -->
				<div class="bg-white/5 rounded-lg p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1 min-w-0">
							<p class="text-white/60 text-xs uppercase tracking-wide mb-1.5">Full Path</p>
							<p class="text-white/80 text-sm break-all font-mono">{file.path}</p>
						</div>
						<button
							type="button"
							onclick={async () => {
								try {
									await navigator.clipboard.writeText(file.path);
								} catch (e) {
									console.error('Failed to copy path:', e);
								}
							}}
							class="shrink-0 px-2 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
							title="Copy path"
						>
							Copy
						</button>
					</div>
				</div>

				<!-- Timestamps -->
				<div class="space-y-3">
					<!-- Modified Time -->
					<div class="bg-white/5 rounded-lg p-3">
						<p class="text-white/60 text-xs uppercase tracking-wide mb-1.5">Modified</p>
						<p class="text-white font-medium text-sm">{formatDate(data.modified)}</p>
					</div>

					<!-- Accessed Time -->
					{#if data.accessed}
						<div class="bg-white/5 rounded-lg p-3">
							<p class="text-white/60 text-xs uppercase tracking-wide mb-1.5">Accessed</p>
							<p class="text-white font-medium text-sm">{formatDate(data.accessed)}</p>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="flex items-center justify-center py-8">
				<p class="text-white/60">Loading properties...</p>
			</div>
		{/if}
	</ModalBody>
	<ModalFooter>
		<Button variant="ghost" onclick={handleClose}>Close</Button>
	</ModalFooter>
</Modal>
