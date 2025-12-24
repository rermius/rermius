<script>
	import {
		CheckCircle2,
		XCircle,
		Upload,
		Download,
		Loader2,
		X,
		ChevronUp,
		ChevronDown
	} from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';
	import { statusBarStore } from '$lib/stores/status-bar';

	const state = $derived($statusBarStore);
	const visible = $derived(state.totalCount > 0);

	function handleToggleExpand() {
		statusBarStore.toggleExpand();
	}

	function handleCancelTransfer(id) {
		statusBarStore.cancelTransfer(id);
	}

	const statusConfig = {
		uploading: {
			icon: Loader2,
			text: 'Uploading',
			color: 'text-white',
			bgColor: 'bg-blue-500'
		},
		downloading: {
			icon: Loader2,
			text: 'Downloading',
			color: 'text-white',
			bgColor: 'bg-blue-500'
		},
		success: {
			icon: CheckCircle2,
			color: 'text-white',
			bgColor: 'bg-green-500'
		},
		error: {
			icon: XCircle,
			text: 'Failed',
			color: 'text-white',
			bgColor: 'bg-red-500'
		}
	};

	// Determine overall status for collapsed view
	const overallStatus = $derived(() => {
		if (state.transfers.length === 0) return 'idle';

		const hasActive = state.transfers.some(
			t => t.status === 'uploading' || t.status === 'downloading'
		);
		if (hasActive) {
			const hasUpload = state.transfers.some(t => t.status === 'uploading');
			return hasUpload ? 'uploading' : 'downloading';
		}

		const hasError = state.transfers.some(t => t.status === 'error');
		if (hasError) return 'error';

		return 'success';
	});

	const overallConfig = $derived(statusConfig[overallStatus()] || statusConfig.uploading);
	const actionText = $derived(state.action === 'upload' ? 'uploading' : 'downloading');
	const activeTransfers = $derived(
		state.transfers.filter(t => t.status === 'uploading' || t.status === 'downloading')
	);
	const completedTransfers = $derived(
		state.transfers.filter(t => t.status === 'success' || t.status === 'error')
	);
	const sortedTransfers = $derived([...activeTransfers, ...completedTransfers]);
</script>

{#if visible}
	<div
		class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg-secondary transition-all duration-300 {overallConfig.bgColor}"
		role="status"
		aria-live="polite"
	>
		{#if !state.isExpanded}
			<!-- Collapsed View: Minimal Bar -->
			<div class="px-4 py-2 flex items-center gap-3 text-xs text-white">
				<!-- Status Icon -->
				{#if overallConfig}
					{@const Icon = overallConfig.icon}
					<Icon
						size={16}
						class="{overallConfig.color} {overallStatus() === 'uploading' ||
						overallStatus() === 'downloading'
							? 'animate-spin'
							: ''}"
					/>
				{/if}

				<!-- Action Icon -->
				{#if state.action === 'upload'}
					<Upload size={14} class="text-white" />
				{:else}
					<Download size={14} class="text-white" />
				{/if}

				<!-- Count Text -->
				<span class="font-medium">
					{state.totalCount}
					{state.totalCount === 1 ? 'file' : 'files'}
					{actionText}
				</span>

				<!-- Spacer -->
				<div class="flex-1"></div>

				<!-- Expand Button -->
				<button
					type="button"
					class="p-1 hover:bg-white/20 rounded transition-colors"
					onclick={handleToggleExpand}
					title="Expand"
					aria-label="Expand transfer list"
				>
					<ChevronUp size={16} class="text-white" />
				</button>
			</div>
		{:else}
			<!-- Expanded View: Full List -->
			<div class="bg-[#1D2033] border-t border-border bg-bg-secondary">
				<!-- Header -->
				<div class="px-4 py-2 flex items-center gap-3 text-xs text-white border-b bg-bg-secondary">
					<!-- Status Icon -->
					{#if overallConfig}
						{@const Icon = overallConfig.icon}
						<Icon
							size={16}
							class="{overallConfig.color} {overallStatus() === 'uploading' ||
							overallStatus() === 'downloading'
								? 'animate-spin'
								: ''}"
						/>
					{/if}

					<!-- Title -->
					<span class="font-medium">
						{overallConfig.text}
						{state.totalCount}
						{state.totalCount === 1 ? 'file' : 'files'}
					</span>

					<!-- Spacer -->
					<div class="flex-1"></div>

					<!-- Collapse Button -->
					<button
						type="button"
						class="p-1 hover:bg-white/20 rounded transition-colors"
						onclick={handleToggleExpand}
						title="Collapse"
						aria-label="Collapse transfer list"
					>
						<ChevronDown size={16} class="text-white" />
					</button>
				</div>

				<!-- Transfer List -->
				<ScrollArea class="max-h-[144px]">
					{#each sortedTransfers as transfer (transfer.id)}
						{@const isActive = transfer.status === 'uploading' || transfer.status === 'downloading'}
						{@const transferConfig = statusConfig[transfer.status] || statusConfig.uploading}
						{@const StatusIcon = transferConfig.icon}
						<div
							class="px-4 py-2 flex items-center gap-3 text-xs text-white border-b bg-bg-secondary/50 hover:bg-white/5 transition-colors"
						>
							<!-- Status Icon -->
							<StatusIcon
								size={14}
								class="{transferConfig.color} {isActive ? 'animate-spin' : ''}"
							/>

							<!-- File Name -->
							<div class="flex-1 min-w-0">
								<div class="truncate font-medium">
									{transfer.fileName}
								</div>
								{#if transfer.fromPath && transfer.toPath}
									<div class="text-[10px] text-white/60 truncate">
										{transfer.fromPath} → {transfer.toPath}
									</div>
								{/if}
							</div>

							<!-- Progress Bar -->
							{#if isActive || transfer.status === 'success'}
								<div class="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
									<div
										class="h-full bg-white transition-all duration-200"
										style="width: {transfer.progress}%"
									></div>
								</div>
								<span class="text-white/80 tabular-nums w-10 text-right">
									{transfer.progress}%
								</span>
							{/if}

							<!-- Cancel Button (only for active transfers) -->
							{#if isActive && transfer.onCancel}
								<button
									type="button"
									class="p-1 hover:bg-white/20 rounded transition-colors"
									onclick={() => handleCancelTransfer(transfer.id)}
									title="Cancel"
									aria-label="Cancel transfer"
								>
									<X size={14} class="text-white hover:text-white/80" />
								</button>
							{/if}

							<!-- Error Message -->
							{#if transfer.status === 'error' && transfer.errorMessage}
								<span class="text-red-300 text-[10px] truncate max-w-[200px]">
									{transfer.errorMessage}
								</span>
							{/if}
						</div>
					{/each}
				</ScrollArea>
			</div>
		{/if}
	</div>
{/if}

<style>
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>
