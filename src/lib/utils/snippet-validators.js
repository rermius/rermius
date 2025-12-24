/**
 * Validation utilities for snippet operations
 */

/**
 * Validate snippet execution requirements
 * @param {Object} snippet - Snippet object
 * @param {string} snippet.command - Snippet command
 * @param {string|null} sessionId - Active terminal session ID
 * @returns {{valid: boolean, error?: string}}
 */
export function validateSnippetExecution(snippet, sessionId) {
	if (!sessionId) {
		return { valid: false, error: 'No active terminal session' };
	}

	if (!snippet?.command?.trim()) {
		return { valid: false, error: 'Snippet has no command' };
	}

	return { valid: true };
}
