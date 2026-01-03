<script>
	import { getFileIcon, modeToPermissionsString } from '$lib/utils';
	import * as LucideIcons from 'lucide-svelte';

	const {
		file,
		isSelected = false,
		selectedFiles = [],
		type = 'local',
		hasHost = false,
		enableSsh = true,
		canPaste = false,
		isCut = false,
		shouldStartEdit = false,
		onSelect,
		onDoubleClick,
		onAction,
		onDragStart,
		onDragEnd
	} = $props();

	let isEditing = $state(false);
	let editName = $state('');
	let isDragging = $state(false);
	let editInputRef = $state(null);
	let lastShouldStartEdit = $state(false);

	// Focus input when editing starts
	$effect(() => {
		if (isEditing && editInputRef) {
			editInputRef.focus();
			editInputRef.select();
		}
	});

	// Start edit when shouldStartEdit changes from false to true
	$effect(() => {
		if (
			shouldStartEdit &&
			!lastShouldStartEdit &&
			isSelected &&
			file.path &&
			file.name !== '..' &&
			!isEditing
		) {
			startEdit();
		}
		lastShouldStartEdit = shouldStartEdit;
	});

	function getIconComponent(file) {
		const iconName = getFileIcon(file.name, file.isDirectory, file.isSymlink);
		if (file.name === '..') {
			return LucideIcons.ArrowUp;
		}
		// Map icon name to Lucide component
		const iconMap = {
			Folder: LucideIcons.Folder,
			FolderOpen: LucideIcons.FolderOpen,
			FolderSymlink: LucideIcons.FolderSymlink,
			FileSymlink: LucideIcons.FileSymlink,
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

	function formatSize(bytes) {
		if (bytes === undefined || bytes === null) return '--';
		if (bytes === 0) return '0 B';

		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
	}

	function formatDate(dateStr) {
		if (!dateStr) return '--';
		try {
			// Try parsing as Unix timestamp (number string)
			const timestamp = parseInt(dateStr);
			if (!isNaN(timestamp) && timestamp > 0) {
				const date = new Date(timestamp * 1000);
				if (!isNaN(date.getTime())) {
					return (
						date.toLocaleDateString() +
						', ' +
						date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
					);
				}
			}

			// FTP format: "Dec 19 01:24" or "Nov 17 2024"
			const parts = dateStr.trim().split(/\s+/);
			if (parts.length === 3) {
				const [month, day, yearOrTime] = parts;
				const currentYear = new Date().getFullYear();

				if (yearOrTime.includes(':')) {
					// Has time: use current year
					const dateWithYear = `${month} ${day}, ${currentYear} ${yearOrTime}`;
					const date = new Date(dateWithYear);
					if (!isNaN(date.getTime())) {
						// If future date, use last year
						if (date > new Date()) {
							date.setFullYear(currentYear - 1);
						}
						return (
							date.toLocaleDateString() +
							', ' +
							date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
						);
					}
				} else {
					// Has year
					const dateWithYear = `${month} ${day}, ${yearOrTime}`;
					const date = new Date(dateWithYear);
					if (!isNaN(date.getTime())) {
						return date.toLocaleDateString();
					}
				}
			}

			// Fallback: try direct parse
			const date = new Date(dateStr);
			if (!isNaN(date.getTime())) {
				return (
					date.toLocaleDateString() +
					', ' +
					date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
				);
			}
			return dateStr;
		} catch {
			return dateStr || '--';
		}
	}

	function getKind(file) {
		if (file.name === '..') return '';
		if (file.isDirectory) return 'folder';
		const ext = file.name.split('.').pop()?.toLowerCase();
		return ext || 'file';
	}

	function handleClick(e) {
		onSelect?.(file, e);
	}

	function handleDblClick() {
		onDoubleClick?.(file);
	}

	function handleKeyDown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick(e);
		} else if (e.key === 'F2' && file.path && file.name !== '..') {
			e.preventDefault();
			startEdit();
		}
	}

	function startEdit() {
		isEditing = true;
		editName = file.name;
	}

	function handleEditBlur() {
		if (editName !== file.name && editName.trim()) {
			onAction?.('rename', { ...file, oldName: file.name, newName: editName.trim() });
		}
		isEditing = false;
	}

	function handleEditKeyDown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleEditBlur();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			isEditing = false;
			editName = file.name;
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			// Prevent browser back navigation when editing
			// Allow normal text editing (Delete/Backspace for text)
			// Stop propagation to prevent global handler
			e.stopPropagation();
		}
	}

	function handleDragStart(e) {
		if (file.name === '..') {
			e.preventDefault();
			return;
		}
		isDragging = true;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('fromFile', JSON.stringify(file));
		onDragStart?.(file, e);
	}

	function handleDragEnd(e) {
		isDragging = false;
		onDragEnd?.(file, e);
	}

	function handleContextAction(actionId) {
		if (actionId === 'rename') {
			startEdit();
		} else {
			onAction?.(actionId, file);
		}
	}
</script>

<div
	class="file-row flex items-center h-8 px-2 cursor-pointer border-l-2 transition-colors
		{isSelected ? 'bg-primary border-active text-white' : 'border-transparent hover:bg-dark-50/50'}
		{isDragging ? 'opacity-50' : ''}"
	class:cut-file={isCut}
	data-file-path={file.path}
	onclick={handleClick}
	onkeydown={handleKeyDown}
	ondblclick={handleDblClick}
	draggable={file.name !== '..'}
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	role="row"
	tabindex="0"
>
	<!-- Icon -->
	<div class="w-6 shrink-0">
		{#if IconComponent}
			{@const Icon = IconComponent}
			<Icon size={16} class={file.isDirectory ? 'text-primary' : 'text-white/50'} />
		{/if}
	</div>

	<!-- Name -->
	<div class="flex-1 min-w-30 max-w-[53%] pr-2">
		{#if isEditing}
			<input
				type="text"
				bind:value={editName}
				bind:this={editInputRef}
				onblur={handleEditBlur}
				onkeydown={handleEditKeyDown}
				class="w-full px-1 text-sm bg-dark-50 border border-active rounded text-white focus:outline-none"
			/>
		{:else}
			<div class="truncate text-sm text-white">{file.name}</div>
			{#if file.permissions && file.name !== '..'}
				{@const permString = (() => {
					try {
						// If already a permissions string (starts with d, -, l, c, b, p, s), use it
						// Format: "drwxr-xr-x", "-rw-r--r--", "lrwxrwxrwx" (10 characters)
						if (
							typeof file.permissions === 'string' &&
							/^[d-lcbsp-][rwx-]{9}$/.test(file.permissions)
						) {
							return file.permissions;
						}
						// Otherwise convert from mode/octal
						return modeToPermissionsString(file.permissions || file.mode, file.isDirectory);
					} catch (e) {
						console.error('[FileRow] Error converting permissions:', e, file);
						return file.permissions || '----------';
					}
				})()}
				<div class="text-[10px] text-white/40 font-mono">{permString}</div>
			{/if}
		{/if}
	</div>

	<!-- Date Modified -->
	<div class="w-33 shrink-0 text-xs text-white/60 truncate pl-2">
		{formatDate(file.modified)}
	</div>

	<!-- Size -->
	<div class="w-24 shrink-0 text-xs text-white/60 text-right">
		{file.isDirectory ? '--' : formatSize(file.size)}
	</div>

	<!-- Kind -->
	<div class="w-16 shrink-0 text-xs text-white/50 text-right pl-2">
		{getKind(file)}
	</div>
</div>

<style>
	.file-row:focus {
		outline: none;
		background-color: var(--color-dark-50);
	}

	/* Visual feedback for cut files */
	.file-row.cut-file {
		opacity: 0.5;
	}

	.file-row.cut-file:hover {
		opacity: 0.6;
	}
</style>
