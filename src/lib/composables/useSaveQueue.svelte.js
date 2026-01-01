/**
 * Single Save Queue Pattern
 * - Tất cả save requests đi qua 1 queue duy nhất
 * - Auto-cancel pending saves
 * - Simple state: isDirty + isSaving + error
 * - Sequential execution guaranteed
 * - Separate callbacks for auto-save vs manual save
 */
export function useSaveQueue(saveFn, options = {}) {
	const { debounceMs = 300, onAutoSave, onManualSave, onError } = options;

	// Simple state
	let isDirty = $state(false);
	let isSaving = $state(false);
	let lastSaved = $state(null);
	let error = $state(null);
	let lastSavedData = null;
	let debounceTimer = null;
	let currentSavePromise = null;
	let hasInitialized = $state(false); // Track if initial data is loaded

	/**
	 * Single save function - handles all cases
	 * @param {Object} data - Form data to save
	 * @param {Object} options - { immediate = false }
	 */
	async function save(data, { immediate = false } = {}) {
		const dataStr = JSON.stringify(data);

		// Skip if data unchanged from last save
		if (dataStr === lastSavedData) {
			return { success: true, skipped: true };
		}

		// Mark as dirty
		isDirty = true;
		error = null;

		// Clear any pending debounced save
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		// If immediate (manual save), execute now
		if (immediate) {
			return await executeSave(data, dataStr, true);
		}

		// For auto-save: Skip if this is initial data load
		if (!hasInitialized) {
			// First trigger - just mark as initialized, don't save yet
			lastSavedData = dataStr;
			hasInitialized = true;
			isDirty = false;
			return { success: true, skipped: true, reason: 'initial_load' };
		}

		// Auto-save: debounce
		return new Promise(resolve => {
			debounceTimer = setTimeout(async () => {
				const result = await executeSave(data, dataStr, false);
				resolve(result);
			}, debounceMs);
		});
	}

	/**
	 * Internal: Execute the actual save
	 * @param {Object} data - Form data
	 * @param {string} dataStr - Stringified data for comparison
	 * @param {boolean} isManual - true if manual save, false if auto-save
	 */
	async function executeSave(data, dataStr, isManual) {
		// Wait for any ongoing save to finish
		if (currentSavePromise) {
			await currentSavePromise;
		}

		try {
			isSaving = true;
			error = null;

			const savePromise = saveFn(data);
			currentSavePromise = savePromise;

			// Add minimum loading time of 300ms to make loading state visible
			const minLoadingTime = new Promise(resolve => setTimeout(resolve, 300));
			const [result] = await Promise.all([savePromise, minLoadingTime]);

			// Success
			isDirty = false;
			isSaving = false;
			lastSaved = Date.now();
			lastSavedData = dataStr;
			currentSavePromise = null;

			// Call appropriate callback based on save type
			if (isManual) {
				onManualSave?.(result); // Manual save: can trigger onsave, reset form, etc.
			} else {
				onAutoSave?.(result); // Auto-save: just log, no side effects
			}

			return { success: true, result };
		} catch (err) {
			isSaving = false;
			error = err.message || String(err);
			currentSavePromise = null;

			onError?.(err);

			return { success: false, error: err };
		}
	}

	/**
	 * Reset state (when panel closes or form resets)
	 */
	function reset() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		isDirty = false;
		isSaving = false;
		lastSaved = null;
		error = null;
		lastSavedData = null;
		debounceTimer = null;
		currentSavePromise = null;
		hasInitialized = false; // Reset initialization flag
	}

	/**
	 * Computed status for UI
	 */
	const status = $derived(() => {
		if (error) return 'error';
		if (isSaving) return 'saving';
		if (isDirty) return 'editing';
		if (lastSaved !== null) return 'saved';
		return 'idle';
	});

	return {
		save, // (data, {immediate}) => Promise
		reset, // () => void

		// Reactive state
		get isDirty() {
			return isDirty;
		},
		get isSaving() {
			return isSaving;
		},
		get error() {
			return error;
		},
		get status() {
			return status();
		}
	};
}
