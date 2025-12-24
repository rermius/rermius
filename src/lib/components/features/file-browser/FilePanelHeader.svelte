<script>
	import { Folder } from 'lucide-svelte';

	let {
		title = 'Files',
		type = 'local' // local | sftp | ftp
	} = $props();

	const iconMap = {
		local: Folder,
		sftp: Folder,
		ftp: Folder
	};

	const PanelIcon = $derived(iconMap[type] || Folder);

	function getTypeColor() {
		switch (type) {
			case 'sftp':
				return 'text-primary';
			case 'ftp':
				return 'text-accent-orange';
			default:
				return 'text-active';
		}
	}
</script>

<div class="file-panel-header flex items-center h-10 px-3 border-b border-border bg-bg-secondary">
	<!-- Title -->
	<div class="flex items-center gap-2">
		{#if PanelIcon}
			{@const Icon = PanelIcon}
			<Icon size={18} class={getTypeColor()} />
		{/if}
		<span class="text-sm font-medium text-white">{title}</span>
		<span class="text-xs text-white/40 uppercase">{type}</span>
	</div>
</div>
