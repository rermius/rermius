/**
 * Keyboard shortcuts handler
 * Separated from FilePanel for reusability
 */

/**
 * Handle global keyboard shortcuts for file browser
 */
export function createKeyboardShortcutsHandler(options) {
	const { files, selectedIds, handleFileAction, handleAction, handleRefresh, setSelectedIds } =
		options;

	return function handleGlobalKeyDown(e) {
		// Only handle if no input is focused (including rename input)
		if (
			document.activeElement?.tagName === 'INPUT' ||
			document.activeElement?.tagName === 'TEXTAREA' ||
			document.activeElement?.contentEditable === 'true'
		) {
			return;
		}

		const selectedFiles = files.filter(f => selectedIds.includes(f.path));

		// Ctrl/Cmd + C: Copy
		if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
			e.preventDefault();
			if (selectedFiles.length > 0) {
				handleFileAction('copy', selectedFiles[0]);
			}
			return;
		}

		// Ctrl/Cmd + X: Cut
		if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
			e.preventDefault();
			if (selectedFiles.length > 0) {
				handleFileAction('cut', selectedFiles[0]);
			}
			return;
		}

		// Ctrl/Cmd + V: Paste
		if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
			e.preventDefault();
			handleFileAction('paste', null);
			return;
		}

		// Ctrl/Cmd + A: Select All
		if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
			e.preventDefault();
			setSelectedIds(files.map(f => f.path));
			return;
		}

		// F2: Rename
		if (e.key === 'F2') {
			e.preventDefault();
			if (selectedFiles.length === 1) {
				handleFileAction('rename', selectedFiles[0]);
			}
			return;
		}

		// F5: Refresh
		if (e.key === 'F5') {
			e.preventDefault();
			handleRefresh();
			return;
		}

		// Delete: Delete selected files
		// Check for both 'Delete' and 'Backspace' (some keyboards use Backspace for Delete)
		if (e.key === 'Delete' || e.key === 'Backspace') {
			if (selectedFiles.length > 0) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				handleAction('delete');
				return;
			} else {
				// Even without selected files, prevent browser back navigation in file browser
				e.preventDefault();
				e.stopPropagation();
				return;
			}
		}
	};
}
