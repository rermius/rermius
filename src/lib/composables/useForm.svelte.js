import { writable } from 'svelte/store';

/**
 * Form composable for handling form state and validation with Svelte 5 runes pattern
 * @param {Object} options - Form configuration options
 * @param {Object} options.initialValues - Initial form values
 * @param {Function} options.validate - Validation function that returns errors object
 * @param {Function} options.onSubmit - Submit handler function
 * @returns {Object} Form state and methods
 */
export function useForm(options) {
	const { initialValues = {}, validate, onSubmit } = options;

	// Create stores for form state
	const values = writable(initialValues);
	const errors = writable({});
	const touched = writable({});
	const isSubmitting = writable(false);
	const isValid = writable(true);

	/**
	 * Handle form submission
	 * @param {Event} event - Form submit event
	 */
	async function handleSubmit(event) {
		event?.preventDefault();

		isSubmitting.set(true);

		// Get current values
		let currentValues;
		const unsubscribe = values.subscribe(v => (currentValues = v));
		unsubscribe();

		// Run validation if provided
		if (validate) {
			const validationErrors = validate(currentValues);
			errors.set(validationErrors);

			const hasErrors = Object.keys(validationErrors).length > 0;
			isValid.set(!hasErrors);

			if (hasErrors) {
				isSubmitting.set(false);
				return;
			}
		}

		// Submit form
		try {
			if (onSubmit) {
				await onSubmit(currentValues);
			}
			errors.set({});
		} catch (error) {
			errors.update(e => ({
				...e,
				_form: error.message || 'An error occurred'
			}));
			isValid.set(false);
		} finally {
			isSubmitting.set(false);
		}
	}

	/**
	 * Set field value
	 * @param {string} field - Field name
	 * @param {*} value - New value
	 */
	function setFieldValue(field, value) {
		values.update(v => {
			const newValues = { ...v, [field]: value };

			// Re-validate form after value change
			if (validate) {
				const validationErrors = validate(newValues);
				errors.set(validationErrors);

				const hasErrors = Object.keys(validationErrors).length > 0;
				isValid.set(!hasErrors);
			}

			return newValues;
		});

		// Mark field as touched
		touched.update(t => ({ ...t, [field]: true }));

		// Clear error for this field (will be re-validated above)
		errors.update(e => {
			const newErrors = { ...e };
			delete newErrors[field];
			return newErrors;
		});
	}

	/**
	 * Set field error
	 * @param {string} field - Field name
	 * @param {string} error - Error message
	 */
	function setFieldError(field, error) {
		errors.update(e => ({ ...e, [field]: error }));
		isValid.set(false);
	}

	/**
	 * Clear all errors
	 */
	function clearErrors() {
		errors.set({});
		isValid.set(true);
	}

	/**
	 * Reset form to initial state
	 */
	function reset() {
		values.set(initialValues);
		errors.set({});
		touched.set({});
		isSubmitting.set(false);
		isValid.set(true);
	}

	/**
	 * Set all values at once
	 * @param {Object} newValues - New values object
	 */
	function setValues(newValues) {
		values.set(newValues);
	}

	/**
	 * Validate specific field
	 * @param {string} field - Field name
	 */
	function validateField(field) {
		if (!validate) return;

		let currentValues;
		const unsubscribe = values.subscribe(v => (currentValues = v));
		unsubscribe();

		const allErrors = validate(currentValues);

		if (allErrors[field]) {
			setFieldError(field, allErrors[field]);
		} else {
			errors.update(e => {
				const newErrors = { ...e };
				delete newErrors[field];
				return newErrors;
			});
		}
	}

	return {
		// Stores (use with $ in Svelte components)
		values,
		errors,
		touched,
		isSubmitting,
		isValid,

		// Methods
		handleSubmit,
		setFieldValue,
		setFieldError,
		clearErrors,
		reset,
		setValues,
		validateField
	};
}
