import { debounce } from './debounce.js';

/**
 * Creates a debounced validation function
 * @param {Function} validator - The validation function to debounce
 * @param {number} delay - Delay in milliseconds (default: 300)
 * @returns {Function} Debounced validation function
 */
export function createDebouncedValidator(validator, delay = 300) {
	return debounce(validator, delay);
}

/**
 * Creates a validation handler with debounce for form fields
 * @param {Function} validator - Validation function that takes value and returns error message or empty string
 * @param {Function} setError - Function to set the error state
 * @param {number} delay - Delay in milliseconds (default: 300)
 * @returns {Function} Validation handler function
 */
export function createValidationHandler(validator, setError, delay = 300) {
	const debouncedValidator = debounce(value => {
		const error = validator(value);
		setError(error);
	}, delay);

	return event => {
		const value = event?.target?.value ?? event;
		// Clear error immediately if value is empty
		if (!value || (typeof value === 'string' && !value.trim())) {
			setError('');
			return;
		}
		// Debounce the validation
		debouncedValidator(value);
	};
}

/**
 * Creates a duplicate check validator
 * @param {Function} checkDuplicate - Function that checks for duplicates (value, excludeId) => boolean
 * @param {Function} setError - Function to set the error state
 * @param {string|number|null} excludeId - ID to exclude from duplicate check (for edit mode)
 * @param {number} delay - Delay in milliseconds (default: 300)
 * @returns {Function} Validation handler function
 */
export function createDuplicateValidator(checkDuplicate, setError, excludeId = null, delay = 300) {
	return createValidationHandler(
		value => {
			const trimmed = typeof value === 'string' ? value.trim() : value;
			if (!trimmed) {
				return '';
			}
			return checkDuplicate(trimmed, excludeId) ? 'This value already exists' : '';
		},
		setError,
		delay
	);
}
