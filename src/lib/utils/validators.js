/**
 * Form validation utilities
 * Returns null for valid, error message string for invalid
 */

/**
 * Validates hostname format (domain or IP)
 * @param {string} hostname - Hostname to validate
 * @returns {string|null} Error message or null
 */
export function validateHostname(hostname) {
	if (!hostname || hostname.trim() === '') {
		return 'Hostname is required';
	}

	const trimmed = hostname.trim();

	if (trimmed.length < 3) {
		return 'Hostname must be at least 3 characters';
	}

	// Check for valid hostname or IP address
	const hostnameRegex = /^[a-zA-Z0-9.-]+$/;
	const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

	if (!hostnameRegex.test(trimmed) && !ipRegex.test(trimmed)) {
		return 'Invalid hostname format';
	}

	return null;
}

/**
 * Validates port number
 * @param {number|string} port - Port number to validate
 * @returns {string|null} Error message or null
 */
export function validatePort(port) {
	if (!port) return null; // Port is optional (default 22)

	const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

	if (isNaN(portNum)) {
		return 'Port must be a number';
	}

	if (portNum < 1 || portNum > 65535) {
		return 'Port must be between 1 and 65535';
	}

	return null;
}

/**
 * Validates username
 * @param {string} username - Username to validate
 * @returns {string|null} Error message or null
 */
export function validateUsername(username) {
	if (!username || username.trim() === '') {
		return 'Username is required';
	}

	const trimmed = username.trim();

	if (trimmed.length < 1) {
		return 'Username cannot be empty';
	}

	// Basic username validation (alphanumeric, dash, underscore)
	const usernameRegex = /^[a-zA-Z0-9_-]+$/;
	if (!usernameRegex.test(trimmed)) {
		return 'Username can only contain letters, numbers, dashes, and underscores';
	}

	return null;
}

/**
 * Validates email address
 * @param {string} email - Email to validate
 * @returns {string|null} Error message or null
 */
export function validateEmail(email) {
	if (!email || email.trim() === '') {
		return 'Email is required';
	}

	const trimmed = email.trim();
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	if (!emailRegex.test(trimmed)) {
		return 'Invalid email format';
	}

	return null;
}

/**
 * Validates required field
 * @param {*} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} Error message or null
 */
export function validateRequired(value, fieldName = 'This field') {
	if (value === null || value === undefined || value === '') {
		return `${fieldName} is required`;
	}

	if (typeof value === 'string' && value.trim() === '') {
		return `${fieldName} is required`;
	}

	return null;
}

/**
 * Validates minimum length
 * @param {string} value - Value to validate
 * @param {number} minLength - Minimum length
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} Error message or null
 */
export function validateMinLength(value, minLength, fieldName = 'This field') {
	if (!value) return null; // Use validateRequired for required checks

	if (value.length < minLength) {
		return `${fieldName} must be at least ${minLength} characters`;
	}

	return null;
}

/**
 * Validates maximum length
 * @param {string} value - Value to validate
 * @param {number} maxLength - Maximum length
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} Error message or null
 */
export function validateMaxLength(value, maxLength, fieldName = 'This field') {
	if (!value) return null;

	if (value.length > maxLength) {
		return `${fieldName} must be at most ${maxLength} characters`;
	}

	return null;
}

/**
 * Validates entire host object
 * @param {Object} host - Host object to validate
 * @returns {Object} Object with field names as keys and error messages as values
 */
export function validateHost(host) {
	const errors = {};

	const hostnameError = validateHostname(host.hostname);
	if (hostnameError) errors.hostname = hostnameError;

	const portError = validatePort(host.port);
	if (portError) errors.port = portError;

	const usernameError = validateUsername(host.username);
	if (usernameError) errors.username = usernameError;

	return errors;
}

/**
 * Validates file path
 * @param {string} path - File path to validate
 * @returns {string|null} Error message or null
 */
export function validatePath(path) {
	if (!path || path.trim() === '') {
		return 'Path is required';
	}

	// Basic path validation
	if (path.includes('..')) {
		return 'Path cannot contain ..';
	}

	return null;
}

/**
 * Validates workspace name
 * @param {string} name - Workspace name to validate
 * @returns {string|null} Error message or null
 */
export function validateWorkspaceName(name) {
	if (!name || name.trim() === '') {
		return 'Workspace name is required';
	}

	const trimmed = name.trim();

	if (trimmed.length > 50) {
		return 'Workspace name must be at most 50 characters';
	}

	// Prevent filesystem-breaking characters
	// Characters not allowed in Windows/Linux/macOS filenames: <>:"|?*\/
	// Also prevent control characters (\x00-\x1f)
	const invalidChars = /[<>:"|?*\x00-\x1f/\\]/;
	if (invalidChars.test(trimmed)) {
		return 'Workspace name contains invalid characters';
	}

	return null;
}
