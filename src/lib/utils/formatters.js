/**
 * Data formatting utilities
 */

/**
 * Format date to readable string
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
	if (!date) return '';

	try {
		const d = new Date(date);
		if (isNaN(d.getTime())) return '';

		const defaultOptions = {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			...options
		};

		return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
	} catch (error) {
		console.error('Failed to format date:', error);
		return '';
	}
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
	if (!date) return '';

	try {
		const d = new Date(date);
		if (isNaN(d.getTime())) return '';

		const now = new Date();
		const diffMs = now - d;
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffSecs < 60) return 'just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

		return formatDate(d, { year: 'numeric', month: 'short', day: 'numeric' });
	} catch (error) {
		console.error('Failed to format relative time:', error);
		return '';
	}
}

/**
 * Format file size to human readable string
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	if (!bytes || bytes < 0) return '';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	const value = bytes / Math.pow(k, i);
	return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Truncate string with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default '...')
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 50, suffix = '...') {
	if (!str) return '';
	if (str.length <= maxLength) return str;

	return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @param {string} locale - Locale for formatting
 * @returns {string} Formatted number
 */
export function formatNumber(num, locale = 'en-US') {
	if (num === null || num === undefined) return '';

	try {
		return new Intl.NumberFormat(locale).format(num);
	} catch (error) {
		console.error('Failed to format number:', error);
		return String(num);
	}
}

/**
 * Format duration in milliseconds to readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2h 30m")
 */
export function formatDuration(ms) {
	if (!ms || ms < 0) return '0s';

	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
}

/**
 * Format percentage
 * @param {number} value - Value to format as percentage
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, decimals = 0) {
	if (value === null || value === undefined) return '';

	return `${value.toFixed(decimals)}%`;
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert snake_case to Title Case
 * @param {string} str - Snake case string
 * @returns {string} Title case string
 */
export function snakeToTitle(str) {
	if (!str) return '';

	return str
		.split('_')
		.map(word => capitalize(word))
		.join(' ');
}

/**
 * Convert camelCase to Title Case
 * @param {string} str - Camel case string
 * @returns {string} Title case string
 */
export function camelToTitle(str) {
	if (!str) return '';

	return str
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, str => str.toUpperCase())
		.trim();
}
