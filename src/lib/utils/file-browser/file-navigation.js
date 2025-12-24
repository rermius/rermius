/**
 * File navigation utilities
 */

/**
 * Navigate to a new path and update history
 */
export function navigateToPath(
	path,
	oldPath,
	currentHistory,
	currentHistoryIndex,
	maxPathHistory = 20
) {
	if (path === oldPath) {
		return {
			history: currentHistory,
			historyIndex: currentHistoryIndex,
			pathHistory: []
		};
	}

	// Add to history
	const newHistory = currentHistory.slice(0, currentHistoryIndex + 1);
	newHistory.push(path);
	const newHistoryIndex = newHistory.length - 1;

	// Add to path history (for AddressBar dropdown)
	let newPathHistory = [];
	if (oldPath && oldPath !== path) {
		newPathHistory = [oldPath, ...currentHistory].filter(p => p !== path).slice(0, maxPathHistory);
	}

	return {
		history: newHistory,
		historyIndex: newHistoryIndex,
		pathHistory: newPathHistory
	};
}
