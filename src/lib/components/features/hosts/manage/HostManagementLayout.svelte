<script>
	import { ItemCard } from '$lib/components/ui/Card';
	import { ScrollArea } from '$lib/components/ui';
	import { LayoutGrid, List } from 'lucide-svelte';
	import { ContentWithPanel } from '$lib/components/layout';
	import { HostPanel, GroupPanel } from '$lib/components/features/hosts';
	import { handleHostConnect } from '$lib/composables';
	import { get } from 'svelte/store';
	import { tabsStore } from '$lib/stores';
	import { connectFileTransfer } from '$lib/services/file-connection';

	// Props
	const {
		showPanel = false,
		panelType = 'host',
		editingHost = null,
		editingGroup = null,
		hosts = [],
		defaultGroupId = undefined,
		header,
		content: contentSlot,
		panel: panelSlot,
		onaddHost,
		oneditHost,
		onclosePanel,
		onremove,
		onhostSave,
		ongroupSave,
		oncancelRemove,
		onconfirmRemove,
		layoutMode = 'grid'
	} = $props();

	// Event handlers
	function handleAddHost() {
		onaddHost?.();
	}

	function handleEditHost(host) {
		oneditHost?.(host);
	}

	function handleClosePanel() {
		onclosePanel?.();
	}

	function handleRemove() {
		onremove?.();
	}

	function handleHostSave(savedHost) {
		onhostSave?.(savedHost);
	}

	function handleGroupSave(savedGroup) {
		ongroupSave?.(savedGroup);
	}

	function handleCancelRemove() {
		oncancelRemove?.();
	}

	async function handleSftpClick(host) {
		// Create SFTP file browser tab (similar to FTP)
		try {
			const connectionType = host.connectionType || 'ssh';
			if (connectionType !== 'ssh') {
				console.warn('SFTP only available for SSH connections');
				return;
			}

			// Create file browser tab
			const tabId = tabsStore.addFileBrowserTab({
				hostId: host.id,
				baseLabel: host.label,
				connectionType: 'sftp'
			});

			// Connect SFTP session
			const sftpHost = { ...host, connectionType: 'sftp' };
			const updateLogs = log => {
				const currentTabs = get(tabsStore).tabs;
				const currentTab = currentTabs.find(t => t.id === tabId);
				if (currentTab) {
					tabsStore.updateTabConnectionState(tabId, {
						connectionLogs: [...(currentTab.connectionLogs || []), log]
					});
				}
			};

			try {
				const result = await connectFileTransfer(sftpHost, updateLogs);

				// Update tab to CONNECTED state
				tabsStore.updateTabConnectionState(tabId, {
					connectionState: 'CONNECTED',
					sessionId: result.sessionId,
					showProgressAnimation: true
				});

				// Wait for progress animation
				setTimeout(() => {
					tabsStore.updateTabConnectionState(tabId, {
						showProgressAnimation: false
					});
				}, 400);
			} catch (error) {
				// Update tab to FAILED state
				tabsStore.updateTabConnectionState(tabId, {
					connectionState: 'FAILED',
					connectionError: error.message,
					connectionLogs: error.logs || []
				});
			}
		} catch (error) {
			console.error('Failed to open SFTP:', error);
			alert(`Failed to open SFTP: ${error.message}`);
		}
	}
</script>

<ContentWithPanel
	{showPanel}
	showMenu={panelType === 'group' || panelType === 'host'}
	onclose={handleClosePanel}
	onremove={handleRemove}
>
	{#snippet content()}
		<div class="flex flex-col h-full">
			<!-- Header Section -->
			<div class="flex flex-col gap-4.5 items-start bg-bg-secondary p-3">
				<!-- Custom header content (search bar or breadcrumb) -->
				{@render header()}
			</div>

			<!-- Content Section -->
			<ScrollArea class="flex-1">
				<div class="p-6 flex flex-col gap-4">
					<!-- Custom content (groups section or group card) -->
					{@render contentSlot()}

					<!-- Hosts Section (common for both pages) -->
					<div class="flex flex-col gap-2">
						<div class="flex items-center justify-between">
							<h2 class="text-xs font-semibold text-white">Hosts</h2>
						</div>
						<div class={layoutMode === 'grid' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1'}>
							<!-- Add New Host Card -->
							<div class={layoutMode === 'grid' ? '' : 'w-full'}>
								<ItemCard
									label="Enter IP or Hostname..."
									subtitle=""
									icon="server-filled"
									isAddNew
									variant={layoutMode === 'list' ? 'list' : 'card'}
									onclick={handleAddHost}
								/>
							</div>

							<!-- Existing Hosts -->
							{#each hosts as host (host.id)}
								<div class={layoutMode === 'grid' ? '' : 'w-full'}>
									<ItemCard
										label={host.label}
										subtitle="{host.username}@{host.hostname}"
										icon={host.connectionType || 'ssh'}
										variant={layoutMode === 'list' ? 'list' : 'card'}
										showEdit={true}
										showSftpIcon={host.connectionType === 'ssh' || !host.connectionType}
										isActive={editingHost?.id === host.id}
										onedit={() => handleEditHost(host)}
										ondoubleclick={() => handleHostConnect(host)}
										onsftpclick={() => handleSftpClick(host)}
									/>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</ScrollArea>
		</div>
	{/snippet}

	{#snippet panel()}
		{#if panelType === 'host'}
			<HostPanel {editingHost} {defaultGroupId} onsave={handleHostSave} />
		{:else if panelType === 'group'}
			<GroupPanel {editingGroup} onsave={handleGroupSave} />
		{/if}
	{/snippet}
</ContentWithPanel>
