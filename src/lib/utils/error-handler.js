/**
 * Error handling utilities
 */

/**
 * Extract error message from various error types
 * @param {Error|string|Object} error - Error to extract message from
 * @returns {string} Error message
 */
export function getErrorMessage(error) {
	if (!error) return 'An unknown error occurred';

	if (typeof error === 'string') return error;

	if (error instanceof Error) return error.message;

	if (error.message) return error.message;

	if (error.error) return getErrorMessage(error.error);

	try {
		return JSON.stringify(error);
	} catch {
		return 'An unknown error occurred';
	}
}

/**
 * Log error with context
 * @param {Error|string} error - Error to log
 * @param {string} context - Context where error occurred
 * @param {Object} metadata - Additional metadata
 */
export function logError(error, context = '', metadata = {}) {
	const message = getErrorMessage(error);
	const timestamp = new Date().toISOString();

	console.error(`[${timestamp}] Error in ${context}:`, {
		message,
		error,
		metadata
	});

	// Future: Send to error tracking service
	// sendToErrorTracking({ message, context, metadata, timestamp });
}

/**
 * Handle async errors with try-catch wrapper
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} Wrapped function
 */
export function withErrorHandler(fn, context = '') {
	return async function (...args) {
		try {
			return await fn.apply(this, args);
		} catch (error) {
			logError(error, context, { args });
			throw error;
		}
	};
}

/**
 * Create error object with additional context
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} metadata - Additional metadata
 * @returns {Error} Enhanced error object
 */
export function createError(message, code = 'UNKNOWN_ERROR', metadata = {}) {
	const error = new Error(message);
	error.code = code;
	error.metadata = metadata;
	error.timestamp = new Date().toISOString();
	return error;
}

/**
 * Check if error is a specific type
 * @param {Error} error - Error to check
 * @param {string} code - Error code to match
 * @returns {boolean} True if error matches code
 */
export function isErrorCode(error, code) {
	return error && error.code === code;
}

/**
 * Retry function with error handling
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @param {Function} shouldRetry - Function to determine if error should trigger retry
 * @returns {Promise<*>} Result of function
 */
export async function retryWithBackoff(fn, maxRetries = 3, delay = 1000, shouldRetry = () => true) {
	let lastError;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (!shouldRetry(error) || attempt === maxRetries - 1) {
				throw error;
			}

			logError(error, 'Retry attempt', { attempt, maxRetries });

			// Exponential backoff
			const backoffDelay = delay * Math.pow(2, attempt);
			await new Promise(resolve => setTimeout(resolve, backoffDelay));
		}
	}

	throw lastError;
}
