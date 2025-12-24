/**
 * File sorting utilities
 */

/**
 * Sort files array
 */
export function sortFiles(files, sortBy, sortOrder) {
	return [...files].sort((a, b) => {
		// Handle null/undefined files
		if (!a || !b) return 0;
		if (!a.name && !b.name) return 0;
		if (!a.name) return 1;
		if (!b.name) return -1;

		// Directories first
		if (a.isDirectory !== b.isDirectory) {
			return a.isDirectory ? -1 : 1;
		}

		let cmp = 0;
		switch (sortBy) {
			case 'name':
				cmp = (a.name || '').localeCompare(b.name || '');
				break;
			case 'modified':
				cmp = (a.modified || '').localeCompare(b.modified || '');
				break;
			case 'size':
				cmp = (a.size || 0) - (b.size || 0);
				break;
			case 'kind':
				const aExt = a.name ? a.name.split('.').pop() || '' : '';
				const bExt = b.name ? b.name.split('.').pop() || '' : '';
				cmp = aExt.localeCompare(bExt);
				break;
		}

		return sortOrder === 'asc' ? cmp : -cmp;
	});
}

/**
 * Filter files by hidden and keyword
 */
export function filterFiles(files, options = {}) {
	const { showHidden = false, keyword = '', filterText = '' } = options;

	let result = [...files];

	// Filter out invalid files (missing name property)
	result = result.filter(f => f && f.name != null);

	// Filter hidden files
	if (!showHidden) {
		result = result.filter(f => !f.name.startsWith('.'));
	}

	// Filter by keyword (from AddressBar)
	if (keyword) {
		const lower = keyword.toLowerCase();
		result = result.filter(f => f.name.toLowerCase().includes(lower));
	}

	// Filter by text (from header)
	if (filterText) {
		const lower = filterText.toLowerCase();
		result = result.filter(f => f.name.toLowerCase().includes(lower));
	}

	return result;
}
