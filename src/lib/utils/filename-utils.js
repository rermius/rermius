/**
 * Filename utilities
 * Reusable functions for generating unique filenames/labels
 */

/**
 * Generate unique filename/label with (N) suffix if duplicates exist
 *
 * @param {string} baseName - Base name (e.g., "file.txt" or "butterhub-vn")
 * @param {Array<string|Object>} existingNames - Array of existing names or objects with name property
 * @param {Object} options - Options
 * @param {boolean} options.caseSensitive - Whether comparison should be case-sensitive (default: false)
 * @param {boolean} options.onlyFiles - If existingNames are file objects, only check files (not directories) (default: false)
 * @param {Function} options.getName - Function to extract name from object: (item) => string (default: item => item.name || item)
 * @returns {string} Unique name (e.g., "file (1).txt" or "butterhub-vn (2)")
 *
 * @example
 * // For file transfers
 * const uniqueName = generateUniqueName('file.txt', fileList, { onlyFiles: true });
 *
 * @example
 * // For tabs
 * const uniqueLabel = generateUniqueName('butterhub-vn', tabs, { getName: t => t.label });
 */
export function generateUniqueName(baseName, existingNames = [], options = {}) {
	const { caseSensitive = false, onlyFiles = false, getName = item => item.name || item } = options;

	// Extract names from objects or use strings directly
	let names;
	if (existingNames.length > 0 && typeof existingNames[0] === 'object') {
		names = existingNames
			.filter(item => !onlyFiles || !item.isDirectory)
			.map(getName)
			.filter(Boolean);
	} else {
		names = existingNames.filter(Boolean);
	}

	// Create set of existing names (case-insensitive by default)
	const existingSet = new Set(caseSensitive ? names : names.map(n => String(n).toLowerCase()));

	const baseLower = caseSensitive ? baseName : baseName.toLowerCase();

	// Check if original name exists
	if (!existingSet.has(baseLower)) {
		return baseName;
	}

	// Extract base name and extension for files
	// For tabs/labels without extension, treat entire string as base
	const lastDotIndex = baseName.lastIndexOf('.');
	const hasExtension = lastDotIndex > 0 && lastDotIndex < baseName.length - 1;

	const base = hasExtension ? baseName.substring(0, lastDotIndex) : baseName;
	const ext = hasExtension ? baseName.substring(lastDotIndex) : '';

	// Find next available number
	let counter = 1;
	let newName;
	do {
		newName = `${base} (${counter})${ext}`;
		const newNameLower = caseSensitive ? newName : newName.toLowerCase();
		if (!existingSet.has(newNameLower)) {
			return newName;
		}
		counter++;
	} while (counter < 1000);

	// Fallback: if we somehow exceed 1000, return with timestamp
	return `${base} (${Date.now()})${ext}`;
}

/**
 * Generate unique filename for file transfers
 * Convenience wrapper for generateUniqueName with file-specific options
 *
 * @param {string} fileName - Original filename (e.g., "file.txt")
 * @param {Array<Object>} fileList - Array of file objects with {name, isDirectory} properties
 * @returns {string} Unique filename (e.g., "file (1).txt")
 */
export function generateUniqueFileName(fileName, fileList = []) {
	return generateUniqueName(fileName, fileList, {
		onlyFiles: true,
		caseSensitive: false
	});
}

/**
 * Generate unique tab label
 * Convenience wrapper for generateUniqueName with tab-specific options
 *
 * @param {string} baseLabel - Base label (e.g., "butterhub-vn")
 * @param {Array<Object>} existingTabs - Array of tab objects with {label} property
 * @returns {string} Unique label (e.g., "butterhub-vn (2)")
 */
export function generateUniqueTabLabel(baseLabel, existingTabs = []) {
	return generateUniqueName(baseLabel, existingTabs, {
		getName: tab => tab.label,
		caseSensitive: false
	});
}
