/**
 * Composable for executing snippets in terminal
 * Handles validation, execution, and error handling
 */
	import { terminalCommands, incrementSnippetClickCount } from '$lib/services';
import { validateSnippetExecution } from '$lib/utils/snippet-validators';
import { useToast } from './useToast.svelte.js';
import { SNIPPET_ERRORS } from '$lib/constants/snippet-ui.js';

/**
 * @param {string|null|(() => string|null)} sessionIdOrGetter - Active terminal session ID or getter function
 * @returns {Object} Execution methods
 */
export function useSnippetExecution(sessionIdOrGetter) {
	const toast = useToast();

	/**
	 * Get current session ID (reactive)
	 * @returns {string|null}
	 */
	function getSessionId() {
		return typeof sessionIdOrGetter === 'function' ? sessionIdOrGetter() : sessionIdOrGetter;
	}

	/**
	 * Execute snippet command
	 * @param {Object} snippet - Snippet to execute
	 * @param {Object} options - Execution options
	 * @param {boolean} options.execute - If true, execute command (add \r), else just paste
	 * @returns {Promise<void>}
	 */
	async function executeSnippet(snippet, options = {}) {
		const { execute = false } = options;
		const sessionId = getSessionId();

		// Validate snippet and session
		const validation = validateSnippetExecution(snippet, sessionId);
		if (!validation.valid) {
			toast.error(validation.error);
			return;
		}

		try {
			// Prepare command (add \r for execution)
			const command = execute ? snippet.command + '\r' : snippet.command;
			await terminalCommands.writeTerminal(sessionId, command);

			// Track usage
			await incrementSnippetClickCount(snippet.id);
		} catch (error) {
			console.error(`Failed to ${execute ? 'run' : 'paste'} command:`, error);
			const errorMessage = execute ? SNIPPET_ERRORS.RUN_FAILED : SNIPPET_ERRORS.PASTE_FAILED;
			toast.error(errorMessage);
		}
	}

	return {
		/**
		 * Run snippet (execute command immediately)
		 * @param {Object} snippet - Snippet to run
		 */
		run: snippet => executeSnippet(snippet, { execute: true }),

		/**
		 * Paste snippet (paste to terminal input without executing)
		 * @param {Object} snippet - Snippet to paste
		 */
		paste: snippet => executeSnippet(snippet, { execute: false })
	};
}
