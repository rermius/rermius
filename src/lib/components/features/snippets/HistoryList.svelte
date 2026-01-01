<script>
	import { Clock, Loader2 } from 'lucide-svelte';
	import { terminalCommands } from '$lib/services';
	import { terminalStore } from '$lib/stores';
	import { addSnippet } from '$lib/services';
	import { useToast } from '$lib/composables';
	import { SNIPPET_BUTTON_FONT_SIZE } from '$lib/constants/snippet-ui.js';
	import { SearchInput, ScrollArea } from '$lib/components/ui';
	import { shouldFetchHistory, updateHistoryCache } from './history-cache.js';

	const { onPaste = () => {}, sessionId: propSessionId = null } = $props();

	const toast = useToast();

	let historyItems = $state([]);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let savingHistoryId = $state(null);
	let labelInput = $state('');
	let searchQuery = $state('');
	let loadedSessionIds = $state(new Set());

	const activeSessionId = $derived(propSessionId || $terminalStore.activeSessionId);
	const activeSession = $derived(
		($terminalStore.sessions || []).find(session => session.id === activeSessionId)
	);

	const filteredHistoryItems = $derived.by(() => {
		if (!searchQuery.trim()) {
			return historyItems;
		}
		const query = searchQuery.toLowerCase();
		return historyItems.filter(item => item.command.toLowerCase().includes(query));
	});

	$effect(() => {
		const sessions = $terminalStore.sessions || [];

		for (const session of sessions) {
			if (!loadedSessionIds.has(session.id)) {
				loadedSessionIds.add(session.id);

				const { shouldFetch } = shouldFetchHistory(session.id);
				if (shouldFetch) {
					loadHistoryForSession(session.id, session.type, session.shell, false);
				}
			}
		}

		if (!activeSessionId) {
			historyItems = [];
			errorMessage = 'No active terminal session';
			return;
		}

		const { cachedData } = shouldFetchHistory(activeSessionId);
		if (cachedData) {
			historyItems = cachedData;
			errorMessage = '';
		} else {
			const session = sessions.find(s => s.id === activeSessionId);
			if (session) {
				if (!loadedSessionIds.has(activeSessionId)) {
					loadedSessionIds.add(activeSessionId);
				}
				loadHistoryForSession(activeSessionId, session.type, session.shell, true);
			}
		}
	});

	async function loadHistoryForSession(sessionId, sessionType, shell, showLoading = false) {
		if (showLoading && sessionId === activeSessionId) {
			isLoading = true;
		}

		try {
			const history =
				sessionType === 'local'
					? await terminalCommands.fetchLocalHistory({ shell: shell || null, limit: 100 })
					: await terminalCommands.fetchHistory(sessionId, 100);

			const newHistoryItems = [...history].reverse().map((command, index) => ({
				id: `history-${Date.now()}-${index}`,
				command
			}));

			updateHistoryCache(sessionId, newHistoryItems);

			if (sessionId === activeSessionId) {
				historyItems = newHistoryItems;
				errorMessage = '';
			}
		} catch (error) {
			console.error('Failed to fetch history:', error);
			if (sessionId === activeSessionId) {
				errorMessage = error.message || 'Failed to fetch command history';
				historyItems = [];
			}
		} finally {
			if (showLoading && sessionId === activeSessionId) {
				isLoading = false;
			}
		}
	}

	async function fetchHistory(showLoading = true) {
		if (!activeSessionId) {
			errorMessage = 'No active terminal session';
			return;
		}

		const sessions = $terminalStore.sessions || [];
		const session = sessions.find(s => s.id === activeSessionId);

		if (session) {
			await loadHistoryForSession(activeSessionId, session.type, session.shell, showLoading);
		}
	}

	function handlePaste(historyItem) {
		if (!activeSessionId) {
			toast.error('No active terminal session');
			return;
		}
		onPaste?.({ command: historyItem.command });
	}

	function handleSave(historyItem) {
		savingHistoryId = historyItem.id;
		labelInput = ''; // Reset label input
	}

	function handleCancelSave() {
		savingHistoryId = null;
		labelInput = '';
	}

	async function handleDoneSave(historyItem) {
		const label = labelInput.trim();
		if (!label) {
			toast.error('Please enter a label for the snippet');
			return;
		}

		try {
			await addSnippet({
				name: label,
				command: historyItem.command,
				labels: []
			});
			toast.success(`Snippet "${label}" created successfully`);
			savingHistoryId = null;
			labelInput = '';
		} catch (error) {
			console.error('Failed to create snippet:', error);
			toast.error(error.message || 'Failed to create snippet');
		}
	}

	function handleLabelKeydown(event, historyItem) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleDoneSave(historyItem);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			handleCancelSave();
		}
	}
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden">
	{#if isLoading}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<Loader2 size={32} class="text-text-tertiary mx-auto mb-2 animate-spin" />
				<p class="text-xs text-text-secondary">Loading command history...</p>
			</div>
		</div>
	{:else if errorMessage}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<Clock size={32} class="text-text-tertiary mx-auto mb-2" />
				<p class="text-xs text-text-secondary">{errorMessage}</p>
			</div>
		</div>
	{:else if historyItems.length === 0}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<Clock size={32} class="text-text-tertiary mx-auto mb-2" />
				<p class="text-xs text-text-secondary">No command history available</p>
			</div>
		</div>
	{:else}
		<!-- Search Input -->
		<div class="px-3 py-2 border-b border-border">
			<SearchInput bind:value={searchQuery} placeholder="Search history..." class="w-full" />
		</div>

		<!-- History Items List -->
		<ScrollArea class="flex-1">
			{#if filteredHistoryItems.length === 0}
				<div class="flex items-center justify-center p-4">
					<p class="text-xs text-text-tertiary">No matching commands found</p>
				</div>
			{:else}
				{#each filteredHistoryItems as historyItem (historyItem.id)}
					{@const isSaving = savingHistoryId === historyItem.id}

					<div class="p-2 border-b border-border/30 hover:bg-bg-hover transition-colors">
						{#if isSaving}
							<!-- Label Input Mode -->
							<div class="space-y-2">
								<p class="text-[10px] text-text-tertiary">Set a label</p>
								<p class="text-[11px] font-mono text-active">{historyItem.command}</p>
								<input
									type="text"
									bind:value={labelInput}
									onkeydown={e => handleLabelKeydown(e, historyItem)}
									placeholder="Enter label..."
									class="w-full px-2 py-1 text-xs bg-bg-tertiary border border-border rounded text-text-primary placeholder-text-tertiary focus:outline-none focus:border-active"
								/>
								<div class="flex justify-end">
									<button
										type="button"
										onclick={() => handleDoneSave(historyItem)}
										class="px-1.5 py-0.5 font-mono rounded bg-bg-tertiary hover:bg-bg-tertiary text-text-secondary hover:text-active transition-colors"
										style="font-size: {SNIPPET_BUTTON_FONT_SIZE};"
									>
										DONE
									</button>
								</div>
							</div>
						{:else}
							<!-- Normal Display Mode -->
							<div class="flex items-center justify-between gap-2 group">
								<div class="flex-1 min-w-0 font-mono text-[11px] text-text-secondary truncate">
									{historyItem.command}
								</div>
								<div
									class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
								>
									<button
										type="button"
										onclick={() => handleSave(historyItem)}
										class="px-1.5 py-0.5 font-mono rounded bg-bg-tertiary hover:bg-bg-tertiary text-text-secondary hover:text-active transition-colors"
										style="font-size: {SNIPPET_BUTTON_FONT_SIZE};"
										title="Save as snippet"
									>
										SAVE
									</button>
									<button
										type="button"
										onclick={() => handlePaste(historyItem)}
										class="px-1.5 py-0.5 font-mono rounded bg-bg-tertiary hover:bg-bg-tertiary text-text-secondary hover:text-active transition-colors"
										style="font-size: {SNIPPET_BUTTON_FONT_SIZE};"
										title="Paste command"
									>
										PASTE
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</ScrollArea>
	{/if}
</div>
