<script>
	import {
		Eye,
		EyeOff,
		ArrowUp,
		Home,
		Search,
		Star,
		RefreshCw,
		ArrowRight,
		Loader2
	} from 'lucide-svelte';
	import { ScrollArea } from '$lib/components/ui';
	import { resolve } from '$lib/utils';

	let {
		// Path state
		path = '',
		pathTemp = $bindable(''),
		pathHistory = [],

		// UI state
		showHidden = false,
		keyword = '',
		loading = false,
		inputFocus = false,

		// Type
		type = 'local', // 'local' | 'remote'

		// Callbacks
		onPathChange,
		onGo,
		onRefresh,
		onToggleHidden,
		onGoParent,
		onGoHome,
		onKeywordChange,
		onHistorySelect,
		onInputFocus: _onInputFocus,
		onInputBlur: _onInputBlur
	} = $props();

	let inputRef = $state(null);
	const showHistory = $derived(inputFocus && pathHistory.length > 0);
	let showKeywordFilter = $state(false);
	let keywordInput = $state('');

	// Sync keywordInput with keyword prop
	$effect(() => {
		keywordInput = keyword;
	});

	// Sync pathTemp with path when path changes externally (only if input is not focused)
	$effect(() => {
		if (path && path !== pathTemp && !inputFocus) {
			pathTemp = path;
		}
	});

	function handleInputChange(e) {
		pathTemp = e.target.value;
	}

	function handleKeyDown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleGo();
		} else if (e.key === 'Escape') {
			pathTemp = path;
			inputRef?.blur();
		}
	}

	function handleGo() {
		if (loading) return;
		const trimmedPath = pathTemp.trim();
		if (!trimmedPath) {
			pathTemp = path;
			return;
		}

		// If path hasn't changed, trigger refresh instead
		if (trimmedPath === path) {
			onRefresh?.(type);
		} else {
			onGo?.(type, trimmedPath);
		}
	}

	function handleFocus() {
		inputFocus = true;
		_onInputFocus?.(type);
	}

	function handleBlur() {
		setTimeout(() => {
			inputFocus = false;
			_onInputBlur?.(type);
		}, 200);
	}

	function handleHistoryClick(historyPath) {
		onHistorySelect?.(type, historyPath);
		inputFocus = false;
	}

	function handleToggleHidden() {
		onToggleHidden?.(type);
	}

	function handleGoParent() {
		onGoParent?.(type);
	}

	function handleGoHome() {
		onGoHome?.(type);
	}

	function handleKeywordApply() {
		onKeywordChange?.(keywordInput, type);
		showKeywordFilter = false;
	}

	function handleKeywordKeyDown(e) {
		if (e.key === 'Enter') {
			handleKeywordApply();
		}
	}

	const filteredHistory = $derived(pathHistory.filter(h => h !== path));

	const GoIcon = $derived(() => {
		if (loading) return Loader2;
		if (path === pathTemp) return RefreshCw;
		return ArrowRight;
	});
</script>

<div class="address-bar relative py-1">
	<div class="flex items-center gap-1 px-2">
		<!-- Addon Before: Buttons -->
		<div class="flex items-center gap-1 shrink-0">
			<!-- Hidden Files Toggle -->
			<button
				class="p-1 rounded hover:bg-dark-50 transition-colors"
				onclick={handleToggleHidden}
				title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
			>
				{#if showHidden}
					<Eye size={14} class="text-active" />
				{:else}
					<EyeOff size={14} class="text-white/70" />
				{/if}
			</button>

			<!-- Go Parent -->
			<button
				class="p-1 rounded hover:bg-dark-50 transition-colors"
				onclick={handleGoParent}
				title="Go to parent directory"
			>
				<ArrowUp size={14} class="text-white/70" />
			</button>

			<!-- Go Home -->
			<button
				class="p-1 rounded hover:bg-dark-50 transition-colors"
				onclick={handleGoHome}
				title="Go to home directory"
			>
				<Home size={14} class="text-white/70" />
			</button>

			<!-- Keyword Filter -->
			{#if showKeywordFilter}
				<div class="flex items-center gap-1 bg-dark-50 rounded px-2 py-1">
					<Search size={12} class="text-white/50" />
					<input
						type="text"
						bind:value={keywordInput}
						onkeydown={handleKeywordKeyDown}
						placeholder="Filter..."
						class="bg-transparent border-none outline-none text-xs text-white placeholder-white/40 w-24"
					/>
					<button class="text-xs text-active hover:text-active-400" onclick={handleKeywordApply}>
						Apply
					</button>
				</div>
			{:else}
				<button
					class="p-1 rounded hover:bg-dark-50 transition-colors {keyword
						? 'text-active'
						: 'text-white/70'}"
					onclick={() => (showKeywordFilter = true)}
					title="Filter files"
				>
					<Search size={14} />
				</button>
			{/if}

			<!-- Bookmark (Future) -->
			<button
				class="p-1 rounded hover:bg-dark-50 transition-colors text-white/70"
				title="Bookmarks (Coming soon)"
				disabled
			>
				<Star size={14} />
			</button>
		</div>

		<!-- Path Input -->
		<input
			bind:this={inputRef}
			type="text"
			value={pathTemp}
			oninput={handleInputChange}
			onkeydown={handleKeyDown}
			onfocus={handleFocus}
			onblur={handleBlur}
			disabled={loading}
			readonly={false}
			spellcheck="false"
			autocomplete="off"
			class="flex-1 h-7 px-2 text-sm bg-bg-secondary border border-border rounded text-white placeholder-white/40
				focus:outline-none focus:border-active disabled:opacity-50 disabled:cursor-not-allowed
				font-mono"
			placeholder="Enter path..."
		/>

		<!-- Addon After: Go Button -->
		{#if GoIcon()}
			{@const IconComponent = GoIcon()}
			<button
				class="p-1 rounded hover:bg-dark-50 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={handleGo}
				disabled={loading}
				title={path === pathTemp ? 'Refresh' : 'Go to path'}
			>
				<IconComponent size={14} class="text-white/70 {loading ? 'animate-spin' : ''}" />
			</button>
		{/if}
	</div>

	<!-- History Dropdown -->
	{#if showHistory && filteredHistory.length > 0}
		<ScrollArea
			class="absolute left-2 right-2 top-full mt-1 bg-bg-secondary border border-border rounded shadow-lg z-50 max-h-48"
		>
			{#each filteredHistory as historyPath (historyPath)}
				<button
					class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-primary hover:text-white transition-colors border-b bg-bg-secondary last:border-b-0"
					onclick={() => handleHistoryClick(historyPath)}
					onmousedown={e => e.preventDefault()}
				>
					{historyPath}
				</button>
			{/each}
		</ScrollArea>
	{/if}
</div>

<style>
	.address-bar {
		position: relative;
	}
</style>
