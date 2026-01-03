/**
 * Clipboard utilities
 */

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
	if (!text) {
		console.warn('No text provided to copy');
		return false;
	}

	try {
		// Modern clipboard API
		if (navigator.clipboard && navigator.clipboard.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}

		// Fallback for older browsers
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		textArea.style.top = '-999999px';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		const successful = document.execCommand('copy');
		document.body.removeChild(textArea);

		if (!successful) {
			throw new Error('Copy command was unsuccessful');
		}

		return true;
	} catch (error) {
		console.error('Failed to copy to clipboard:', error);
		return false;
	}
}

/**
 * Read text from clipboard
 * @returns {Promise<string|null>} Clipboard text or null
 */
export async function readFromClipboard() {
	try {
		if (navigator.clipboard && navigator.clipboard.readText) {
			const text = await navigator.clipboard.readText();
			return text;
		}

		console.warn('Clipboard read not supported');
		return null;
	} catch (error) {
		console.error('Failed to read from clipboard:', error);
		return null;
	}
}

/**
 * Check if clipboard API is available
 * @returns {boolean} True if clipboard is available
 */
export function isClipboardAvailable() {
	return !!(navigator.clipboard && navigator.clipboard.writeText);
}
