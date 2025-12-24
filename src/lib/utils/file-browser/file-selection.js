/**
 * File selection utilities
 */

/**
 * Handle file selection with Ctrl/Cmd and Shift support
 */
export function handleFileSelection(file, event, selectedIds, displayFiles) {
	if (file.name === '..') {
		return [];
	}

	if (event.ctrlKey || event.metaKey) {
		// Toggle selection
		if (selectedIds.includes(file.path)) {
			return selectedIds.filter(id => id !== file.path);
		} else {
			return [...selectedIds, file.path];
		}
	} else if (event.shiftKey && selectedIds.length > 0) {
		// Range selection
		const lastSelected = selectedIds[selectedIds.length - 1];
		const lastIndex = displayFiles.findIndex(f => f.path === lastSelected);
		const currentIndex = displayFiles.findIndex(f => f.path === file.path);

		const start = Math.min(lastIndex, currentIndex);
		const end = Math.max(lastIndex, currentIndex);

		const range = displayFiles
			.slice(start, end + 1)
			.filter(f => f.name !== '..')
			.map(f => f.path);

		return [...new Set([...selectedIds, ...range])];
	} else {
		// Single selection
		return [file.path];
	}
}
