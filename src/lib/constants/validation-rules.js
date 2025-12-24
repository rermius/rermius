/**
 * Validation rules and regex patterns
 * Centralize validation patterns for consistency
 */

export const VALIDATION_RULES = {
	// Hostname validation
	HOSTNAME_REGEX: /^[a-zA-Z0-9.-]+$/,
	IP_REGEX: /^(\d{1,3}\.){3}\d{1,3}$/,
	IPV6_REGEX: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,

	// Port validation
	PORT_MIN: 1,
	PORT_MAX: 65535,

	// Username validation
	USERNAME_REGEX: /^[a-zA-Z0-9_-]+$/,
	USERNAME_MIN_LENGTH: 1,
	USERNAME_MAX_LENGTH: 32,

	// Password validation
	PASSWORD_MIN_LENGTH: 8,
	PASSWORD_MAX_LENGTH: 128,

	// Email validation
	EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

	// Path validation
	UNIX_PATH_REGEX: /^(\/[^/\0]+)+\/?$/,
	WINDOWS_PATH_REGEX: /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/,

	// Filename validation
	FILENAME_REGEX: /^[a-zA-Z0-9._-]+$/,
	FILENAME_MAX_LENGTH: 255,

	// SSH Key validation
	SSH_KEY_FORMATS: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256'],

	// General limits
	MAX_STRING_LENGTH: 1000,
	MAX_TEXT_LENGTH: 10000,
	MAX_ARRAY_LENGTH: 1000
};

/**
 * Error messages for validation
 */
export const VALIDATION_MESSAGES = {
	REQUIRED: 'This field is required',
	INVALID_FORMAT: 'Invalid format',
	INVALID_HOSTNAME: 'Invalid hostname or IP address',
	INVALID_PORT: 'Port must be between 1 and 65535',
	INVALID_USERNAME: 'Username can only contain letters, numbers, dashes, and underscores',
	INVALID_EMAIL: 'Invalid email address',
	INVALID_PATH: 'Invalid file path',
	TOO_SHORT: min => `Must be at least ${min} characters`,
	TOO_LONG: max => `Must be at most ${max} characters`,
	OUT_OF_RANGE: (min, max) => `Must be between ${min} and ${max}`
};
