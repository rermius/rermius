<script>
	import { File, Pencil, Plus, Server } from 'lucide-svelte';
	import { getConnectionIcon } from '$lib/utils/connection-icons.js';

	const {
		label = '',
		subtitle = '',
		icon = 'server-filled', // This is now a connectionType string
		isAddNew = false,
		showEdit = false,
		isActive = false,
		showSftpIcon = false,
		variant = 'card', // 'card' | 'list'
		onclick,
		ondoubleclick,
		onedit,
		onsftpclick,
		oncontextmenu
	} = $props();

	// Get icon component based on icon prop (connectionType)
	const IconComponent = $derived(isAddNew ? Plus : getConnectionIcon(icon));

	function handleClick() {
		onclick?.();
	}

	function handleDoubleClick() {
		if (!isAddNew) {
			ondoubleclick?.();
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}

	function handleEditKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleEdit(event);
		}
	}

	function handleEdit(event) {
		event.stopPropagation();
		onedit?.();
	}

	function handleSftpClick(event) {
		event.stopPropagation();
		onsftpclick?.();
	}

	function handleSftpKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleSftpClick(event);
		}
	}

	function handleContextMenu(event) {
		event.preventDefault();
		event.stopPropagation();
		oncontextmenu?.({ x: event.clientX, y: event.clientY });
	}
</script>

<div
	role="button"
	tabindex="0"
	onclick={handleClick}
	ondblclick={handleDoubleClick}
	onkeydown={handleKeydown}
	oncontextmenu={handleContextMenu}
	class="group flex items-center gap-2.5 rounded-xl transition-colors {variant === 'list'
		? 'w-full h-14 px-4'
		: 'w-70 h-12 px-3'} {isAddNew
		? 'border-2 border-dashed border-border hover:border-(--color-active) bg-transparent'
		: isActive
			? 'bg-bg-surface border-2 border-(--color-active) shadow-sm'
			: variant === 'list'
				? 'bg-transparent border border-transparent hover:bg-bg-hover hover:border-(--color-active)/60'
				: 'bg-bg-elevated hover:bg-bg-hover border-2 border-transparent hover:border-(--color-active)/60'}"
>
	<!-- Icon with background -->
	<div class="flex items-center justify-center w-8 h-8 rounded-lg bg-(--color-primary)/10 shrink-0">
		{#if IconComponent}
			{@const Icon = IconComponent}
			<Icon size={20} class="text-text-primary transition-colors" />
		{/if}
	</div>

	<!-- Text Content -->
	<div class="flex flex-col gap-0.5 flex-1 text-left min-w-0">
		<span
			class="text-xs font-semibold leading-tight truncate {isAddNew
				? 'text-text-tertiary'
				: 'text-text-primary'}"
		>
			{label}
		</span>
		<span class="text-[10px] font-medium text-text-secondary leading-tight truncate">
			{subtitle}
		</span>
	</div>

	<!-- Action Buttons (only visible on hover) -->
	<div
		class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
	>
		<!-- SFTP Icon (for SSH hosts) -->
		{#if showSftpIcon && !isAddNew}
			<span
				role="button"
				tabindex="0"
				onclick={handleSftpClick}
				onkeydown={handleSftpKeydown}
				title="Open SFTP File Browser"
				class="flex items-center justify-center w-6 h-6 rounded-md bg-bg-tertiary cursor-pointer transition-colors group"
			>
				<File
					size={14}
					class="text-text-secondary group-hover:text-(--color-active) transition-colors"
				/>
			</span>
		{/if}

		<!-- Edit Button -->
		{#if showEdit && !isAddNew}
			<span
				role="button"
				tabindex="0"
				onclick={handleEdit}
				onkeydown={handleEditKeydown}
				title="Edit"
				class="flex items-center justify-center w-6 h-6 rounded-md bg-bg-tertiary cursor-pointer transition-colors group"
			>
				<Pencil
					size={14}
					class="text-text-secondary group-hover:text-(--color-active) transition-colors"
				/>
			</span>
		{/if}
	</div>
</div>
