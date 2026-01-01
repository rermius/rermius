<script>
	import { Code } from 'lucide-svelte';
	import {
		SNIPPET_BUTTON_FONT_SIZE,
		SNIPPET_LABEL_FONT_SIZE,
		SNIPPET_COMMAND_PREVIEW_LENGTH
	} from '$lib/constants/snippet-ui.js';

	const { snippet, onRun, onPaste } = $props();

	let isHovered = $state(false);

	function truncateCommand(command, maxLength = SNIPPET_COMMAND_PREVIEW_LENGTH) {
		if (!command) return 'No command';
		return command.length > maxLength ? command.substring(0, maxLength) + '...' : command;
	}
</script>

<div class="p-2">
	<div
		role="button"
		tabindex="0"
		class="group relative p-2 hover:bg-(--color-bg-hover) transition-colors cursor-pointer rounded-lg"
		onmouseenter={() => (isHovered = true)}
		onmouseleave={() => (isHovered = false)}
	>
		<div class="flex items-start gap-2">
			<Code size={14} class="text-(--color-text-tertiary) mt-0.5 shrink-0" />
			<div class="flex-1 min-w-0">
				<div class="flex items-center justify-between gap-2">
					<div
						class="text-{SNIPPET_LABEL_FONT_SIZE} font-semibold text-(--color-text-primary) truncate"
					>
						{snippet.name}
					</div>
					{#if isHovered}
						<div class="flex items-center gap-1 shrink-0">
							<button
								type="button"
								onclick={e => {
									e.stopPropagation();
									onRun?.(snippet);
								}}
								class="px-1.5 py-0.5 font-mono rounded bg-(--color-bg-tertiary) hover:bg-(--color-bg-tertiary) text-(--color-text-secondary) hover:text-(--color-active) transition-colors"
								style="font-size: {SNIPPET_BUTTON_FONT_SIZE};"
								title="Run command"
							>
								RUN
							</button>
							<button
								type="button"
								onclick={e => {
									e.stopPropagation();
									onPaste?.(snippet);
								}}
								class="px-1.5 py-0.5 font-mono rounded bg-(--color-bg-tertiary) hover:bg-(--color-bg-tertiary) text-(--color-text-secondary) hover:text-(--color-active) transition-colors"
								style="font-size: {SNIPPET_BUTTON_FONT_SIZE};"
								title="Paste command"
							>
								PASTE
							</button>
						</div>
					{/if}
				</div>
				<div class="text-[10px] text-(--color-text-secondary) mt-0.5 font-mono truncate">
					{truncateCommand(snippet.command)}
				</div>
			</div>
		</div>
	</div>
</div>
